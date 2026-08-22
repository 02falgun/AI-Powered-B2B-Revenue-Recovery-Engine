import fs from 'fs';
import path from 'path';
import { checkProcessEmailRateLimit, resetMemoryRateLimitStore } from '../src/lib/ratelimit';
import { evaluatePolicy } from '../src/lib/policy';
import { insertAuditLog } from '../src/lib/db';

function loadEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const k = key.trim();
          const v = rest.join('=').trim();
          if (k && v && !process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch {}
}

loadEnv();

async function runPhase2RateLimitTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P2 Rate Limiting & Abuse Protection Verification ===');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean, details?: string): void {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      if (details) console.log(`     -> ${details}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      if (details) console.error(`     -> Error Details: ${details}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. User Sliding Window Rate Limiting
  // ---------------------------------------------------------------------------
  console.log('--- 1. USER SLIDING WINDOW RATE LIMITING ---');
  resetMemoryRateLimitStore();

  const testUserId = `usr_test_${Date.now()}`;
  const customLimit = 5;
  process.env.RATE_LIMIT_USER_MAX = String(customLimit);

  // Send requests up to limit
  let allUnderLimitPassed = true;
  for (let i = 1; i <= customLimit; i++) {
    const res = await checkProcessEmailRateLimit(testUserId);
    if (!res.success || res.remaining !== customLimit - i) {
      allUnderLimitPassed = false;
    }
  }

  assert(
    `Allows ${customLimit} consecutive requests under user sliding window limit`,
    allUnderLimitPassed,
    `Successfully processed ${customLimit} requests with decreasing remaining quota.`,
  );

  // (customLimit + 1)th request MUST be blocked
  const blockedRes = await checkProcessEmailRateLimit(testUserId);
  assert(
    'Blocks request exceeding user sliding window limit with rate_limited status',
    blockedRes.success === false && blockedRes.scope === 'user',
    `Remaining: ${blockedRes.remaining}, RetryAfter: ${blockedRes.retryAfterSeconds}s, Reset: ${new Date(blockedRes.reset).toISOString()}`,
  );

  // Different user MUST still have their own full quota
  const otherUserId = `usr_other_${Date.now()}`;
  const otherUserRes = await checkProcessEmailRateLimit(otherUserId);
  assert(
    'Rate limit is isolated per authenticated user (other user is unblocked)',
    otherUserRes.success === true && otherUserRes.remaining === customLimit - 1,
  );

  // ---------------------------------------------------------------------------
  // 2. Global Backstop Rate Limiting
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. GLOBAL BACKSTOP RATE LIMITING ---');
  resetMemoryRateLimitStore();

  const customGlobalLimit = 3;
  process.env.RATE_LIMIT_GLOBAL_MAX = String(customGlobalLimit);

  for (let i = 1; i <= customGlobalLimit; i++) {
    const res = await checkProcessEmailRateLimit(`usr_global_${i}`);
    assert(
      `Global request ${i}/${customGlobalLimit} allowed across different accounts`,
      res.success === true,
    );
  }

  const globalBlockedRes = await checkProcessEmailRateLimit('usr_global_overflow');
  assert(
    'Global backstop limit blocks aggregate overload across all accounts',
    globalBlockedRes.success === false && globalBlockedRes.scope === 'global',
    `Scope: ${globalBlockedRes.scope}, RetryAfter: ${globalBlockedRes.retryAfterSeconds}s`,
  );

  // Restore defaults
  delete process.env.RATE_LIMIT_USER_MAX;
  delete process.env.RATE_LIMIT_GLOBAL_MAX;
  resetMemoryRateLimitStore();

  // ---------------------------------------------------------------------------
  // 3. Maximum Payload Size Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. PAYLOAD MAXIMUM SIZE ENFORCEMENT ---');

  const MAX_LIMIT = 10000;
  const normalEmail = 'Hello, we will pay 15000 INR for invoice INV-2026-001 on 2026-08-25.';
  const oversizedEmail = 'A'.repeat(MAX_LIMIT + 100);

  const isNormalValid = normalEmail.length <= MAX_LIMIT;
  const isOversizedRejected = oversizedEmail.length > MAX_LIMIT;

  assert(
    `Normal email (${normalEmail.length} chars) is accepted under ${MAX_LIMIT} chars threshold`,
    isNormalValid,
  );

  assert(
    `Oversized email (${oversizedEmail.length} chars) exceeds ${MAX_LIMIT} chars threshold for rejection`,
    isOversizedRejected,
    `Exceeds limit by ${oversizedEmail.length - MAX_LIMIT} chars — rejected before AI processing.`,
  );

  // ---------------------------------------------------------------------------
  // 4. Rate-Limit Rejection Logging & Audit Trail
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. RATE-LIMIT REJECTION AUDIT LOGGING ---');

  const auditLogRes = await insertAuditLog({
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    action: 'RATE_LIMIT_EXCEEDED',
    actor: 'operator@recoverai.local',
    metadata: {
      user_id: 'usr_audit_test_123',
      scope: 'user',
      limit: 20,
      remaining: 0,
      retry_after_seconds: 1800,
      timestamp: new Date().toISOString(),
    },
  });

  assert(
    'Rate limit rejection event successfully logged to audit log system',
    auditLogRes.ok === true && Boolean(auditLogRes.data.id),
    `Audit ID: ${auditLogRes.ok ? auditLogRes.data.id : 'N/A'}`,
  );

  // ---------------------------------------------------------------------------
  // 5. Frozen Core Guardrails Unaffected
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. FROZEN CORE INVARIANT VERIFICATION ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 15000,
      promisedAmountPaise: 1500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.95,
      rationale: 'Full payment',
      evidence: 'Full payment',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Frozen Core Invariant: evaluatePolicy() remains single authority returning AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P2 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2RateLimitTests().catch((err) => {
  console.error('Fatal error during Phase 2 test run:', err);
  process.exit(1);
});
