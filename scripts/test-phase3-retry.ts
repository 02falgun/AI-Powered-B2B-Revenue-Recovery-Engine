import fs from 'fs';
import path from 'path';
import { withRetry, isTransientError } from '../src/lib/retry';
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

async function runPhase3RetryTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P3 Retry & Reliability Hardening Verification ===');
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
  // 1. Transient Error Filter Recognition
  // ---------------------------------------------------------------------------
  console.log('--- 1. TRANSIENT ERROR CLASSIFICATION ---');

  const timeoutErr = new Error('Request timed out after 10000ms');
  timeoutErr.name = 'AbortError';
  assert(
    'Identifies AbortError/Timeout as transient',
    isTransientError(timeoutErr) === true,
  );

  const connResetErr = new Error('read ECONNRESET');
  assert(
    'Identifies ECONNRESET network drop as transient',
    isTransientError(connResetErr) === true,
  );

  const server503Err = { status: 503, message: 'Service Unavailable' };
  assert(
    'Identifies HTTP 503 as transient',
    isTransientError(server503Err) === true,
  );

  const client400Err = { status: 400, message: 'Bad Request: invalid_amount' };
  assert(
    'Rejects HTTP 400 validation error as non-transient',
    isTransientError(client400Err) === false,
  );

  const client404Err = { status: 404, message: 'Invoice Not Found' };
  assert(
    'Rejects HTTP 404 as non-transient',
    isTransientError(client404Err) === false,
  );

  // ---------------------------------------------------------------------------
  // 2. Simulated Transient Failure Succeeds on Retry (Attempt 2)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. TRANSIENT FAILURE RECOVERS ON RETRY ---');

  let attemptCount1 = 0;
  const retryTrack: Array<{ attempt: number; delayMs: number }> = [];

  const recoveryResult = await withRetry(
    async (attempt) => {
      attemptCount1++;
      if (attempt === 1) {
        const transientTimeout = new Error('Simulated transient AI API gateway timeout');
        transientTimeout.name = 'AbortError';
        throw transientTimeout;
      }
      return {
        intent: 'full_payment',
        promisedAmountPaise: 1500000,
        status: 'recovered_successfully',
      };
    },
    {
      maxRetries: 2,
      initialDelayMs: 20,
      onRetry: (attempt, _err, delayMs) => {
        retryTrack.push({ attempt, delayMs });
      },
    },
  );

  assert(
    'Simulated transient timeout succeeds on attempt 2',
    attemptCount1 === 2 && recoveryResult.status === 'recovered_successfully',
    `Total attempts executed: ${attemptCount1}, Retried after ${retryTrack[0]?.delayMs}ms with jitter`,
  );

  // ---------------------------------------------------------------------------
  // 3. Exhausted Retries Fail Closed Safely
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. EXHAUSTED RETRIES FAIL CLOSED SAFELY ---');

  let attemptCount2 = 0;
  let caughtError: Error | null = null;

  try {
    await withRetry(
      async () => {
        attemptCount2++;
        const persistent500 = new Error('Persistent 500 Internal Server Error');
        Object.assign(persistent500, { status: 500 });
        throw persistent500;
      },
      {
        maxRetries: 2, // 1 initial + 2 retries = 3 attempts
        initialDelayMs: 15,
      },
    );
  } catch (err: unknown) {
    caughtError = err as Error;
  }

  assert(
    'Bounded retries stop after max attempts (3 attempts total) and throw fail-closed',
    attemptCount2 === 3 && caughtError !== null,
    `Executed exactly ${attemptCount2} attempts before raising safe failure.`,
  );

  // ---------------------------------------------------------------------------
  // 4. Non-Transient Error Does NOT Retry (Fails Immediately)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. NON-TRANSIENT ERROR FAILS IMMEDIATELY (0 RETRIES) ---');

  let attemptCount3 = 0;
  let nonTransientCaught: Error | null = null;

  try {
    await withRetry(
      async () => {
        attemptCount3++;
        const valError = new Error('Amount must be positive integer');
        Object.assign(valError, { status: 400 });
        throw valError;
      },
      {
        maxRetries: 2,
        initialDelayMs: 20,
      },
    );
  } catch (err: unknown) {
    nonTransientCaught = err as Error;
  }

  assert(
    'Definitive 400 validation error is not retried (fails immediately on attempt 1)',
    attemptCount3 === 1 && nonTransientCaught !== null,
    `Total attempts: ${attemptCount3} (zero wasted retries on deterministic error).`,
  );

  // ---------------------------------------------------------------------------
  // 5. Frozen Core Policy Engine Invariant Check
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. FROZEN CORE DETERMINISM VERIFICATION ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 15000,
      promisedAmountPaise: 1500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.95,
      rationale: 'Full payment promised',
      evidence: 'We will pay the full amount',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Policy engine evaluatePolicy() remains frozen, deterministic, and sole AUTO_RECOVER authority',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
    `Decision: ${policyRes.decision}, ApprovedPaise: ${policyRes.approvedAmountPaise}`,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P3 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3RetryTests().catch((err) => {
  console.error('Fatal error in Phase P3 tests:', err);
  process.exit(1);
});
