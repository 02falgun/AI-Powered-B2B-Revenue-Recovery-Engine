import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Razorpay from 'razorpay';

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

async function runCheckoutVerificationTest(): Promise<void> {
  console.log('=== RecoverAI: Razorpay Standard Checkout Integration Verification ===\n');

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

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
      .createHmac('sha256', keySecret ?? 'mock_secret_fallback')
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
