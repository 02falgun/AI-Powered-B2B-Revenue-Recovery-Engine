import crypto from 'crypto';
import { verifyRazorpayWebhookSignature } from '../src/lib/razorpay-webhook';

function runWebhookTests(): void {
  console.log('=== RecoverAI: Webhook Signature Verification Unit Tests ===\n');

  const testSecret = 'whsec_test_secret_key_998877';
  const testPayload = JSON.stringify({
    entity: 'event',
    account_id: 'acc_112233',
    event: 'payment.link.paid',
    contains: ['payment_link', 'payment'],
    payload: {
      payment_link: {
        entity: {
          id: 'plink_test123',
          amount: 1500000,
          currency: 'INR',
          status: 'paid',
        },
      },
    },
  });

  // Calculate valid signature
  const validSignature = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');

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

  // Test 1: Valid signature
  const res1 = verifyRazorpayWebhookSignature({
    rawBody: testPayload,
    signature: validSignature,
    secret: testSecret,
  });
  assert('Valid HMAC signature returns isValid = true', res1.ok && res1.data.isValid === true);

  // Test 2: Invalid signature (tampered hash)
  const res2 = verifyRazorpayWebhookSignature({
    rawBody: testPayload,
    signature: 'bad_signature_hash_12345',
    secret: testSecret,
  });
  assert('Invalid signature returns isValid = false', res2.ok && res2.data.isValid === false);

  // Test 3: Tampered body
  const tamperedPayload = testPayload.replace('1500000', '100');
  const res3 = verifyRazorpayWebhookSignature({
    rawBody: tamperedPayload,
    signature: validSignature,
    secret: testSecret,
  });
  assert('Tampered payload returns isValid = false', res3.ok && res3.data.isValid === false);

  // Test 4: Missing secret
  const res4 = verifyRazorpayWebhookSignature({
    rawBody: testPayload,
    signature: validSignature,
    secret: '',
  });
  assert(
    'Missing secret returns validation_error Result',
    !res4.ok && res4.error.code === 'validation_error',
  );

  // Test 5: Missing signature header
  const res5 = verifyRazorpayWebhookSignature({
    rawBody: testPayload,
    signature: '',
    secret: testSecret,
  });
  assert(
    'Missing signature header returns validation_error Result',
    !res5.ok && res5.error.code === 'validation_error',
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWebhookTests();
