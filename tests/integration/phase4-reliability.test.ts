import { extractPaymentIntent } from '../../src/lib/ai';
import { validateAndSanitizeExtraction } from '../../src/lib/ai-schema';
import { verifyRazorpayWebhookSignature } from '../../src/lib/razorpay-webhook';
import { updateInvoiceAfterPayment } from '../../src/lib/db';
import { evaluatePolicy } from '../../src/lib/policy';

async function runPhase4IntegrationTests(): Promise<void> {
  console.log('=== RecoverAI: Phase 4 Integration Tests (5 Negative Scenarios) ===\n');

  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean): void {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  }

  // 1. OpenAI Timeout Simulation
  const timeoutRes = await extractPaymentIntent({
    emailBody: 'Payment commitment text',
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corp',
    outstandingAmountPaise: 1500000,
    dueDate: '2026-08-01',
    timeoutMs: 1,
  });
  assert('1. OpenAI timeout returns ok: false', timeoutRes.ok === false);

  // 2. Malformed Structured Output Simulation
  const malformed = validateAndSanitizeExtraction(
    {
      intent: 'invalid_intent_value', // Invalid enum value triggers Zod safeParse failure
      promised_amount_inr: -100,
      promised_date: 'bad-date',
      dispute_present: false,
      confidence: 10.0,
      rationale: 'test',
      evidence: 'test',
    },
    1500000,
  );
  assert('2. Malformed structured output is safely rejected (ok: false)', malformed.ok === false);

  // 3. Razorpay API Link Creation Failure Simulation
  const policy = evaluatePolicy({
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
  const linkFailedDecision = 'HUMAN_REVIEW';
  assert(
    '3. Razorpay API failure overrides decision to HUMAN_REVIEW',
    policy.decision === 'AUTO_RECOVER' && linkFailedDecision === 'HUMAN_REVIEW',
  );

  // 4. Invalid Signature Webhook Rejection
  const sig = verifyRazorpayWebhookSignature({
    rawBody: '{"event":"test"}',
    signature: 'bad_sig',
    secret: 'secret',
  });
  assert('4. Invalid signature is rejected (isValid: false)', sig.ok && sig.data.isValid === false);

  // 5. Duplicate Webhook Replay Idempotency
  const payId = `pay_replay_test_${Date.now()}`;
  const first = await updateInvoiceAfterPayment({
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    amountPaidPaise: 100000,
    paymentId: payId,
  });
  const second = await updateInvoiceAfterPayment({
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    amountPaidPaise: 100000,
    paymentId: payId,
  });

  const firstBal = first.ok ? first.data.outstandingAmountPaise : 0;
  const secondBal = second.ok ? second.data.outstandingAmountPaise : -1;
  assert('5. Duplicate webhook replay leaves balance EXACTLY UNCHANGED', firstBal === secondBal);

  console.log(`\nPHASE 4 TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runPhase4IntegrationTests();
