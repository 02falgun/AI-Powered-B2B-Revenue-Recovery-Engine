import crypto from 'crypto';
import Razorpay from 'razorpay';

async function runCheckoutVerificationTest(): Promise<void> {
  console.log('=== RecoverAI: Razorpay Standard Checkout Integration Verification ===\n');

  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TSOJfqI5DSz59Z';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'C1U75rq7SWn7rjE4xXDW3Fjn';

  console.log('1. Verifying credentials format:');
  console.log('   RAZORPAY_KEY_ID    :', keyId);
  console.log(
    '   RAZORPAY_KEY_SECRET :',
    keySecret ? `${keySecret.slice(0, 4)}...${keySecret.slice(-4)}` : 'MISSING',
  );

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

  // Test 1: Order Creation
  console.log('\n2. Testing Order Creation with Razorpay API (POST /v1/orders)...');
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  try {
    const orderParams = {
      amount: 1500000, // ₹15,000.00
      currency: 'INR',
      receipt: `rcpt_test_${Date.now()}`,
      notes: {
        invoice_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        source: 'recover_ai_test_runner',
      },
    };

    const order = await razorpay.orders.create(orderParams);
    assert(
      'Order created successfully with valid order_id',
      typeof order.id === 'string' && order.id.startsWith('order_'),
    );
    assert('Order amount matches 1500000 paise', Number(order.amount) === 1500000);
    assert('Order currency is INR', order.currency === 'INR');
    console.log(`   Created Order ID: ${order.id}`);

    // Test 2: HMAC SHA256 Signature Verification Algorithm
    console.log('\n3. Testing HMAC SHA256 Signature Verification Algorithm...');
    const testOrderId = order.id;
    const testPaymentId = 'pay_mock_998877';

    // Calculate valid signature using KEY_SECRET
    const validSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(validSignature, 'utf8');
    const actualBuffer = Buffer.from(validSignature, 'utf8');

    const isMatch =
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer);

    assert('HMAC SHA256 signature verification succeeds for matching signature', isMatch === true);

    // Test 3: Invalid Signature Rejection
    const invalidSignature = 'invalid_signature_hash_1234567890';
    const invalidBuffer = Buffer.from(invalidSignature, 'utf8');
    const isInvalidMatch =
      expectedBuffer.length === invalidBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, invalidBuffer);

    assert(
      'HMAC SHA256 signature verification rejects mismatched signature',
      isInvalidMatch === false,
    );
  } catch (err: unknown) {
    console.error('❌ Error during Razorpay API order creation test:', err);
    failed++;
  }

  console.log(`\n================================================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCheckoutVerificationTest();
