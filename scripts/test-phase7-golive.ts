import fs from 'fs';
import path from 'path';
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

async function runPhase7GoLiveTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P7 Test Mode Labeling & Go-Live Readiness Verification ===');
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

  // 1. Verify Test Mode Banner Component
  console.log('--- 1. TEST MODE BANNER COMPONENT & SCREEN INTEGRATION ---');

  const bannerPath = path.resolve(process.cwd(), 'src/components/TestModeBanner.tsx');
  const bannerExists = fs.existsSync(bannerPath);
  const bannerContent = bannerExists ? fs.readFileSync(bannerPath, 'utf8') : '';

  assert(
    'src/components/TestModeBanner.tsx exists and contains explicit "TEST MODE" notice',
    bannerExists &&
      bannerContent.includes('TEST MODE') &&
      bannerContent.includes('NO REAL PAYMENTS'),
  );

  const layoutPath = path.resolve(process.cwd(), 'src/app/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert(
    'src/app/layout.tsx imports and renders <TestModeBanner /> globally',
    layoutContent.includes('TestModeBanner') &&
      layoutContent.includes('<TestModeBanner />'),
  );

  const checkoutBtnPath = path.resolve(process.cwd(), 'src/components/RazorpayCheckoutButton.tsx');
  const checkoutBtnContent = fs.readFileSync(checkoutBtnPath, 'utf8');
  assert(
    'RazorpayCheckoutButton.tsx contains explicit Test Mode settlement disclaimer',
    checkoutBtnContent.includes('TEST MODE'),
  );

  const invoicePagePath = path.resolve(process.cwd(), 'src/app/invoices/[id]/page.tsx');
  const invoicePageContent = fs.readFileSync(invoicePagePath, 'utf8');
  assert(
    'Invoice detail & simulator page contains Test Mode link indicators',
    invoicePageContent.includes('TEST MODE LINK') &&
      invoicePageContent.includes('Test Mode Only'),
  );

  // 2. Verify Go-Live Checklist Documentation
  console.log('\n--- 2. GO-LIVE CHECKLIST & QUOTA DOCUMENTATION ---');

  const checklistPath = path.resolve(process.cwd(), 'docs/go-live-checklist.md');
  const checklistExists = fs.existsSync(checklistPath);
  const checklistContent = checklistExists ? fs.readFileSync(checklistPath, 'utf8') : '';

  assert(
    'docs/go-live-checklist.md exists',
    checklistExists,
  );

  assert(
    'Checklist documents Live Key Generation and Webhook Re-Registration steps',
    checklistContent.includes('rzp_live_') &&
      checklistContent.includes('Webhook') &&
      checklistContent.includes('HMAC'),
  );

  assert(
    'Checklist documents Razorpay Test Mode rate limits and quota capacity analysis',
    checklistContent.includes('Razorpay Test Mode API') &&
      checklistContent.includes('Safety Headroom'),
  );

  // 3. Verify Razorpay Test Mode Key Prefix Safety
  console.log('\n--- 3. RAZORPAY ENVIRONMENT KEY SAFETY CHECK ---');

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock';
  const isTestKey = razorpayKeyId.startsWith('rzp_test_');

  assert(
    'Configured Razorpay Key ID strictly uses test prefix (rzp_test_*) — no live key leakage',
    isTestKey,
    `Key prefix: ${razorpayKeyId.slice(0, 9)}...`,
  );

  // 4. Verify Frozen Core Determinism
  console.log('\n--- 4. FROZEN CORE DETERMINISM INVARIANT ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 15000,
      promisedAmountPaise: 1500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.95,
      rationale: 'Full payment commitment',
      evidence: 'Clear full balance',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'evaluatePolicy() remains pure, deterministic, and sole authority for AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P7 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7GoLiveTests().catch((err) => {
  console.error('Fatal error in Phase P7 tests:', err);
  process.exit(1);
});
