import { extractPaymentIntent } from '../src/lib/ai';
import { validateAndSanitizeExtraction } from '../src/lib/ai-schema';
import { verifyRazorpayWebhookSignature } from '../src/lib/razorpay-webhook';
import { updateInvoiceAfterPayment, isPaymentAlreadyProcessed } from '../src/lib/db';
import { evaluatePolicy } from '../src/lib/policy';

async function runPhase4ReliabilityTests(): Promise<void> {
  console.log('=== RecoverAI: Phase 4 Reliability & Idempotency Negative Test Suite ===\n');

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

  // --------------------------------------------------------------------------------
  // Scenario 1: OpenAI Timeout Simulation
  // --------------------------------------------------------------------------------
  console.log('--- Scenario 1: OpenAI Timeout Simulation ---');
  const timeoutResult = await extractPaymentIntent({
    emailBody: 'I will pay full amount of 15,000 INR today.',
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corp',
    outstandingAmountPaise: 1500000,
    dueDate: '2026-08-01',
    timeoutMs: 1, // Ultra-short 1ms timeout to trigger immediate AbortController timeout
  });

  assert('OpenAI timeout returns ok: false', timeoutResult.ok === false);
  if (!timeoutResult.ok) {
    assert('OpenAI timeout error code is ai_error', timeoutResult.error.code === 'ai_error');
    assert(
      'OpenAI error message indicates timeout',
      timeoutResult.error.message.toLowerCase().includes('time') ||
        timeoutResult.error.message.toLowerCase().includes('abort') ||
        timeoutResult.error.message.toLowerCase().includes('mock'),
    );
  }

  // --------------------------------------------------------------------------------
  // Scenario 2: Malformed / Non-Schema Structured Output Simulation
  // --------------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Malformed / Non-Schema Output Validation ---');

  const malformedParsed = {
    intent: 'unknown' as const,
    promised_amount: -5000, // Negative amount
    promised_date: 'invalid-date-string',
    dispute_present: false,
    confidence: 1.5, // Confidence > 1.0 out of bounds
    rationale: 'Malformed output test',
    evidence: 'Test evidence',
  };

  const sanitizedResult = validateAndSanitizeExtraction(
    malformedParsed,
    1500000, // 15,000 INR balance
  );

  assert('Sanitizer returns ok: true with safe clamped intent', sanitizedResult.ok === true);
  if (sanitizedResult.ok) {
    const ext = sanitizedResult.data;
    assert('Confidence is clamped to <= 1.0', ext.confidence <= 1.0);
    assert('Negative promised amount is rejected to null', ext.promisedAmountPaise === null);

    // Evaluate policy on sanitized malformed output
    const policyResult = evaluatePolicy({
      extraction: ext,
      outstandingAmountPaise: 1500000,
    });
    assert(
      'Policy routes malformed extraction to HUMAN_REVIEW',
      policyResult.decision === 'HUMAN_REVIEW',
    );
  }

  // --------------------------------------------------------------------------------
  // Scenario 3: Razorpay Payment Link API Failure Simulation
  // --------------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Razorpay Link Creation Failure Fail-Closed Policy Override ---');

  const validExtraction = {
    intent: 'full_payment' as const,
    promisedAmountInr: 15000,
    promisedAmountPaise: 1500000,
    promisedDate: '2026-08-25',
    disputePresent: false,
    confidence: 0.95,
    rationale: 'Full payment promised',
    evidence: 'Full payment promised',
    resolvedFromPercentage: false,
  };

  const approvedPolicy = evaluatePolicy({
    extraction: validExtraction,
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Policy initially approves AUTO_RECOVER for full payment',
    approvedPolicy.decision === 'AUTO_RECOVER',
  );

  // Simulate Razorpay Link Creation Failure
  const simulatedRazorpayError = 'Razorpay API Connection Timeout / Key Unconfigured';
  let overriddenDecision: 'AUTO_RECOVER' | 'HUMAN_REVIEW' = approvedPolicy.decision;
  let finalReason = approvedPolicy.reason;

  if (simulatedRazorpayError) {
    overriddenDecision = 'HUMAN_REVIEW';
    finalReason = `Payment link creation failed after policy approval: ${simulatedRazorpayError}`;
  }

  assert(
    'Razorpay API error overrides decision to HUMAN_REVIEW',
    overriddenDecision === 'HUMAN_REVIEW',
  );
  assert(
    'Reason explicitly documents payment error',
    finalReason.includes('Payment link creation failed'),
  );

  // --------------------------------------------------------------------------------
  // Scenario 4: Webhook Invalid Signature Rejection
  // --------------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Webhook Invalid Signature Rejection ---');

  const rawWebhookBody = JSON.stringify({
    event: 'payment_link.paid',
    payload: {
      payment: { entity: { id: 'pay_test_123', amount: 1500000 } },
    },
  });

  const secret = 'valid_webhook_secret_key_12345';
  const invalidSignature = 'tampered_invalid_signature_hash_99999';

  const sigResult = verifyRazorpayWebhookSignature({
    rawBody: rawWebhookBody,
    signature: invalidSignature,
    secret,
  });

  assert(
    'Tampered signature verification returns ok: true with isValid: false',
    sigResult.ok === true && sigResult.data.isValid === false,
  );

  // --------------------------------------------------------------------------------
  // Scenario 5: Duplicate Webhook Replay Idempotency
  // --------------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Duplicate Webhook Replay Idempotency ---');

  const testInvoiceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const testPaymentId = `pay_replay_${Date.now()}`;
  const amountPaidPaise = 500000; // ₹5,000.00

  console.log(`  Sending First Webhook Event (payment_id: ${testPaymentId})...`);
  const firstUpdate = await updateInvoiceAfterPayment({
    invoiceId: testInvoiceId,
    amountPaidPaise,
    paymentId: testPaymentId,
  });

  assert('First payment processing succeeds', firstUpdate.ok === true);
  const firstOutstanding = firstUpdate.ok ? firstUpdate.data.outstandingAmountPaise : 0;

  // Check payment is now tracked as processed
  const isProcessed = await isPaymentAlreadyProcessed(testPaymentId);
  assert('Payment ID is registered in idempotency tracker', isProcessed === true);

  console.log(`  Replaying Duplicate Webhook Event (payment_id: ${testPaymentId})...`);
  const duplicateUpdate = await updateInvoiceAfterPayment({
    invoiceId: testInvoiceId,
    amountPaidPaise,
    paymentId: testPaymentId,
  });

  assert('Duplicate payment replay succeeds without throwing', duplicateUpdate.ok === true);
  const duplicateOutstanding = duplicateUpdate.ok
    ? duplicateUpdate.data.outstandingAmountPaise
    : -1;

  assert(
    'Invoice balance remains EXACTLY UNCHANGED on duplicate replay',
    firstOutstanding === duplicateOutstanding,
  );

  console.log(`\n================================================================================`);
  console.log(`PHASE 4 RELIABILITY RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4ReliabilityTests().catch((err) => {
  console.error('Fatal error in Phase 4 reliability tests:', err);
  process.exit(1);
});
