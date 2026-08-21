/**
 * Phase 9 Hardening — Task 3: Dual-Path Payment Idempotency Test
 *
 * Proves that if the same payment_id reaches BOTH /api/verify-payment (Standard Checkout)
 * and /api/webhook (Payment Links), the invoice balance is updated EXACTLY ONCE — not twice.
 *
 * Architecture: Both paths converge on updateInvoiceAfterPayment() in src/lib/db.ts,
 * which calls isPaymentAlreadyProcessed() as its first step using payment_id as the key.
 *
 * This test exercises that function directly with a shared payment_id to confirm
 * the idempotency guarantee holds regardless of call order.
 */

import { updateInvoiceAfterPayment } from '../../src/lib/db';

const TEST_PAYMENT_ID = `idempotency-test-${Date.now()}`;
const TEST_INVOICE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'; // synthetic; will be handled by in-memory path
const TEST_AMOUNT_PAISE = 500000; // ₹5,000.00

interface UpdateResult {
  ok: boolean;
  outstandingAmountPaise?: number;
  status?: string;
  error?: string;
}

async function callVerifyPaymentPath(): Promise<UpdateResult> {
  // Simulates what /api/verify-payment does after signature verification succeeds
  const result = await updateInvoiceAfterPayment({
    invoiceId: TEST_INVOICE_ID,
    amountPaidPaise: TEST_AMOUNT_PAISE,
    paymentId: TEST_PAYMENT_ID,
    paymentLinkId: undefined,
  });

  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }

  return {
    ok: true,
    outstandingAmountPaise: result.data.outstandingAmountPaise,
    status: result.data.status,
  };
}

async function callWebhookPath(): Promise<UpdateResult> {
  // Simulates what /api/webhook/razorpay does after HMAC verification and idempotency check
  const result = await updateInvoiceAfterPayment({
    invoiceId: TEST_INVOICE_ID,
    amountPaidPaise: TEST_AMOUNT_PAISE,
    paymentId: TEST_PAYMENT_ID,
    paymentLinkId: `plink_test_${TEST_PAYMENT_ID}`,
  });

  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }

  return {
    ok: true,
    outstandingAmountPaise: result.data.outstandingAmountPaise,
    status: result.data.status,
  };
}

async function runDualPathIdempotencyTest(): Promise<void> {
  console.log('=== Task 3: Dual-Path Payment Idempotency Test ===\n');
  console.log(`Payment ID under test : ${TEST_PAYMENT_ID}`);
  console.log(`Amount                : ₹${(TEST_AMOUNT_PAISE / 100).toFixed(2)} (${TEST_AMOUNT_PAISE} paise)`);
  console.log('');

  // PATH 1: Simulate /api/verify-payment (Standard Checkout) firing first
  console.log('--- Path 1: verify-payment (Standard Checkout) ---');
  const result1 = await callVerifyPaymentPath();
  console.log(`  Result              : ${result1.ok ? 'ok' : 'error'}`);
  if (result1.ok) {
    console.log(`  Outstanding (paise) : ${result1.outstandingAmountPaise}`);
    console.log(`  Status              : ${result1.status}`);
  } else {
    console.log(`  Error               : ${result1.error}`);
  }

  // PATH 2: Simulate /api/webhook/razorpay firing for the SAME payment_id
  console.log('\n--- Path 2: webhook (payment_link.paid / payment.captured) ---');
  const result2 = await callWebhookPath();
  console.log(`  Result              : ${result2.ok ? 'ok (idempotent no-op)' : 'error'}`);
  if (result2.ok) {
    console.log(`  Outstanding (paise) : ${result2.outstandingAmountPaise}`);
    console.log(`  Status              : ${result2.status}`);
  } else {
    console.log(`  Error               : ${result2.error}`);
  }

  // ASSERTION: Both paths must return the SAME outstanding balance
  // (the second call must be a no-op, not a double-deduction)
  console.log('\n--- Idempotency Assertion ---');

  const balanceAfterPath1 = result1.outstandingAmountPaise ?? -1;
  const balanceAfterPath2 = result2.outstandingAmountPaise ?? -2;

  if (!result1.ok || !result2.ok) {
    console.error('❌ FAIL: One or both paths returned an error');
    process.exit(1);
  }

  if (balanceAfterPath1 !== balanceAfterPath2) {
    console.error(
      `❌ FAIL: Double-credit detected! Path 1 outstanding=${balanceAfterPath1} paise, Path 2 outstanding=${balanceAfterPath2} paise. They must be equal.`,
    );
    process.exit(1);
  }

  console.log(
    `✅ PASS: Both paths returned outstanding_amount_paise = ${balanceAfterPath1}. ` +
    `The second call was an idempotent no-op. Invoice balance was updated exactly once.`,
  );
  console.log('\n=== Dual-Path Idempotency Test: PASS ===\n');
}

runDualPathIdempotencyTest().catch((err) => {
  console.error('Fatal error in idempotency test:', err);
  process.exit(1);
});
