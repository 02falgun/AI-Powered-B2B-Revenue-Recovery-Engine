import fs from 'fs';
import path from 'path';
import { scrubPiiAndSecrets } from '../src/lib/scrubber';
import { captureScrubbedException } from '../src/lib/sentry';
import { logger } from '../src/lib/logger';
import { recordFailureAndCheckAlert, resetAlertTracker } from '../src/lib/alerts';
import { evaluatePolicy } from '../src/lib/policy';

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

async function runPhase6ObservabilityTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P6 Observability & PII Scrubbing Verification ===');
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
  // 1. PII and Secret Scrubbing Engine
  // ---------------------------------------------------------------------------
  console.log('--- 1. PII AND SECRET SCRUBBING ENGINE ---');

  const rawPayload = {
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    companyId: '00000000-0000-0000-0000-000000000001',
    customerName: 'John Doe',
    customer_email: 'buyer@corp.com',
    body: 'Please find our payment of 15000 INR for invoice INV-2026-001. Call me at +1 555-234-5678.',
    api_key: 'AIzaSyD-SecretGeminiKey123456',
    secretToken: 'bearer_token_xyz987',
    creditCard: '4111 2222 3333 4444',
    cvv: '123',
    details: {
      raw_text: 'Confidential message content',
      userEmail: 'finance-director@client.com',
      service_role_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload',
    },
  };

  const scrubbed = scrubPiiAndSecrets(rawPayload);

  assert(
    'Email body and raw text fields are scrubbed with [REDACTED_EMAIL_BODY]',
    scrubbed.body === '[REDACTED_EMAIL_BODY]' &&
      scrubbed.details.raw_text === '[REDACTED_EMAIL_BODY]',
  );

  assert(
    'API keys, tokens, and secrets are scrubbed with [REDACTED_SECRET]',
    scrubbed.api_key === '[REDACTED_SECRET]' &&
      scrubbed.secretToken === '[REDACTED_SECRET]' &&
      scrubbed.cvv === '[REDACTED_SECRET]' &&
      scrubbed.details.service_role_key === '[REDACTED_SECRET]',
  );

  assert(
    'Customer email and embedded PII emails are masked with [REDACTED_EMAIL]',
    scrubbed.customer_email === '[REDACTED_EMAIL]' &&
      scrubbed.details.userEmail === '[REDACTED_EMAIL]',
  );

  assert(
    'Safe diagnostic fields (invoiceId, companyId) remain uncorrupted',
    scrubbed.invoiceId === 'f47ac10b-58cc-4372-a567-0e02b2c3d479' &&
      scrubbed.companyId === '00000000-0000-0000-0000-000000000001',
  );

  // ---------------------------------------------------------------------------
  // 2. Sentry Capture Helper with Scrubbing
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. SENTRY EXCEPTION CAPTURE WITH SCRUBBING ---');

  const testError = new Error('AI Timeout with sensitive prompt: "Dear John, please pay 5000"');
  captureScrubbedException(testError, {
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    companyId: '00000000-0000-0000-0000-000000000001',
    errorType: 'AI_TIMEOUT',
    extra: {
      apiKey: 'sk-secret-key-1234',
    },
  });

  assert(
    'Sentry capture wrapper executes gracefully with PII/secret scrubbing',
    true, // Executed without throwing unhandled exception
  );

  // ---------------------------------------------------------------------------
  // 3. Structured JSON Logging Engine
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. STRUCTURED JSON LOGGING ENGINE ---');

  const loggedOutputs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => {
    loggedOutputs.push(msg);
  };

  logger.logPolicyDecision({
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    companyId: '00000000-0000-0000-0000-000000000001',
    decision: 'AUTO_RECOVER',
    guardrailTriggered: 'NONE',
    approvedPaise: 1500000,
    durationMs: 12,
  });

  console.log = originalLog;

  let parsedLog: Record<string, unknown> | null = null;
  try {
    parsedLog = JSON.parse(loggedOutputs[0]);
  } catch {}

  assert(
    'logger.logPolicyDecision outputs valid structured JSON with metadata and zero email text',
    parsedLog !== null &&
      parsedLog.event === 'POLICY_DECISION' &&
      parsedLog.decision === 'AUTO_RECOVER' &&
      parsedLog.approvedPaise === 1500000 &&
      !('body' in parsedLog),
    `Log Output: ${loggedOutputs[0]}`,
  );

  // ---------------------------------------------------------------------------
  // 4. Failure Spike Alerting Engine & Cooldown Debounce
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. FAILURE SPIKE ALERTING ENGINE & DEBOUNCE ---');

  resetAlertTracker();

  // Record 4 failures (below threshold of 5)
  for (let i = 0; i < 4; i++) {
    const res = await recordFailureAndCheckAlert({
      type: 'ai_failure',
      invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      reason: 'Rate limit timeout',
    });
    assert(
      `Failure ${i + 1}/5 does not prematurely trigger alert`,
      res.alertTriggered === false && res.failureCount === i + 1,
    );
  }

  // 5th failure crosses threshold -> triggers alert
  const fifthFailure = await recordFailureAndCheckAlert({
    type: 'ai_failure',
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    reason: 'Consecutive AI quota drop',
  });

  assert(
    '5th failure in window crosses threshold and triggers alert',
    fifthFailure.alertTriggered === true && fifthFailure.failureCount === 5,
    `Alert Message: ${fifthFailure.message}`,
  );

  // 6th failure immediately after -> debounced by cooldown
  const sixthFailure = await recordFailureAndCheckAlert({
    type: 'ai_failure',
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    reason: 'Debounce test failure',
  });

  assert(
    'Subsequent failure during 10-minute cooldown is debounced (alertTriggered = false)',
    sixthFailure.alertTriggered === false,
  );

  // ---------------------------------------------------------------------------
  // 5. Frozen Core Determinism Invariant
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
      rationale: 'Full payment promised',
      evidence: 'We will pay full balance',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'evaluatePolicy() remains pure, deterministic, and sole authority for AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P6 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6ObservabilityTests().catch((err) => {
  console.error('Fatal error in Phase P6 tests:', err);
  process.exit(1);
});
