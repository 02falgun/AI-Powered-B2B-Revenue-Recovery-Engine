import fs from 'fs';
import path from 'path';
import { createTestPaymentLink } from '../src/lib/razorpay';

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

async function runDevTest(): Promise<void> {
  console.log('=== RecoverAI: Razorpay Test Payment Link Verification ===');

  const testParams = {
    amountPaise: 1500000, // ₹15,000.00
    currency: 'INR' as const,
    description: 'Payment link for overdue Invoice #INV-2026-001',
    customerName: 'Acme Corporation',
    customerEmail: 'finance@acmecorp.com',
    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  };

  console.log('Attempting to create payment link with params:', testParams);

  const result = await createTestPaymentLink(testParams);

  if (result.ok) {
    console.log('✅ SUCCESS! Payment link created successfully.');
    console.log('   Payment Link ID:', result.data.paymentLinkId);
    console.log('   Short URL:', result.data.shortUrl);
    console.log('   Status:', result.data.status);
    console.log('   Amount (Paise):', result.data.amountPaise);
  } else {
    console.log(
      '❌ FAIL-CLOSED EXPLICIT ERROR RETURNED (Expected if mock/invalid credentials provided):',
    );
    console.log('   Error Code:', result.error.code);
    console.log('   Error Message:', result.error.message);
  }
}

runDevTest().catch((err: unknown) => {
  console.error('Unexpected top-level error in test runner script:', err);
  process.exit(1);
});
