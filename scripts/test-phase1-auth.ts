import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { updateSession } from '../src/lib/supabase/middleware';
import { NextRequest } from 'next/server';
import { evaluatePolicy } from '../src/lib/policy';
import { getUserProfileById, upsertUserProfile, overrideInvoiceStatus } from '../src/lib/db';
import { verifyRazorpayWebhookSignature } from '../src/lib/razorpay-webhook';

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

async function runPhase1AuthTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P1 Real Login & Access Control Verification ===');
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
  // 1. Next.js Middleware Gatekeeper & Webhook Exemption Tests
  // ---------------------------------------------------------------------------
  console.log('--- 1. MIDDLEWARE SECURITY & WEBHOOK EXEMPTION ---');

  // 1.1 Webhook route without session cookie MUST be exempted and reachable
  const webhookUrl = 'http://localhost:3000/api/webhook/razorpay';
  const webhookReq = new NextRequest(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': 'mock_signature_test',
    },
  });
  const webhookRes = await updateSession(webhookReq);
  assert(
    'Razorpay Webhook (/api/webhook/razorpay) is EXEMPT from session requirement',
    webhookRes.status !== 401 && webhookRes.status !== 307 && webhookRes.status !== 302,
    `Status: ${webhookRes.status} (Allowed through middleware to signature verification)`,
  );

  // 1.2 Protected API route without session cookie MUST be blocked with 401
  const protectedApiReq = new NextRequest('http://localhost:3000/api/invoices', {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  });
  const protectedApiRes = await updateSession(protectedApiReq);
  const isApiBlocked = protectedApiRes.status === 401;
  assert(
    'Unauthenticated API call (/api/invoices) is blocked with HTTP 401',
    isApiBlocked,
    `Returned HTTP ${protectedApiRes.status}`,
  );

  // 1.3 Protected web page (/invoices/123) without session redirects to /login
  const protectedPageReq = new NextRequest('http://localhost:3000/invoices/f47ac10b-58cc-4372-a567-0e02b2c3d479', {
    method: 'GET',
  });
  const protectedPageRes = await updateSession(protectedPageReq);
  const isRedirectToLogin =
    protectedPageRes.status === 307 ||
    protectedPageRes.status === 302 ||
    protectedPageRes.headers.get('location')?.includes('/login');
  assert(
    'Unauthenticated page request redirects to /login',
    Boolean(isRedirectToLogin),
    `Redirect Location: ${protectedPageRes.headers.get('location') ?? 'N/A'}`,
  );

  // 1.4 Public routes (/login, /signup) pass through without auth
  const loginPageReq = new NextRequest('http://localhost:3000/login', { method: 'GET' });
  const loginPageRes = await updateSession(loginPageReq);
  assert(
    'Public login page (/login) passes through middleware',
    loginPageRes.status === 200 || !loginPageRes.headers.get('location'),
  );

  // ---------------------------------------------------------------------------
  // 2. Webhook Signature Verification with Zero Session Auth
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. RAZORPAY WEBHOOK REACHABILITY & SIGNATURE VERIFICATION ---');

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockwebhooksecret1234567890';
  const testPayload = JSON.stringify({
    event: 'payment_link.paid',
    payload: {
      payment_link: {
        entity: {
          id: 'plink_test_phase1',
          amount: 1500000,
          notes: { invoice_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        },
      },
      payment: {
        entity: {
          id: `pay_p1_test_${Date.now()}`,
          amount: 1500000,
        },
      },
    },
  });

  const validSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(testPayload)
    .digest('hex');

  const sigResult = verifyRazorpayWebhookSignature({
    rawBody: testPayload,
    signature: validSignature,
    secret: webhookSecret,
  });

  assert(
    'Plain webhook request with valid HMAC signature succeeds with NO session cookie',
    sigResult.ok && sigResult.data.isValid === true,
    'HMAC signature verification verified independently of user session',
  );

  // ---------------------------------------------------------------------------
  // 3. User Profiles & Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. USER PROFILES & ROLE-BASED ACCESS CONTROL (RBAC) ---');

  const testOperatorId = `usr_op_${Date.now()}`;
  const testAdminId = `usr_admin_${Date.now()}`;

  // 3.1 Create Operator profile
  const opProfile = await upsertUserProfile({
    userId: testOperatorId,
    role: 'operator',
    email: 'operator@recoverai.local',
  });
  assert(
    'Operator profile created with role="operator"',
    opProfile.ok && opProfile.data.role === 'operator',
  );

  // 3.2 Create Admin profile
  const adminProfile = await upsertUserProfile({
    userId: testAdminId,
    role: 'admin',
    email: 'admin@recoverai.local',
  });
  assert(
    'Admin profile created with role="admin"',
    adminProfile.ok && adminProfile.data.role === 'admin',
  );

  // 3.3 Query profile by ID
  const fetchedAdmin = await getUserProfileById(testAdminId);
  assert(
    'getUserProfileById resolves Admin profile role correctly',
    fetchedAdmin.ok && fetchedAdmin.data.role === 'admin',
  );

  // 3.4 Demo Admin & Operator Role Verification
  const demoAdminProfile = await upsertUserProfile({
    userId: 'demo-admin-test-id',
    role: 'admin',
    email: 'admin@acmecorp.com',
  });
  assert(
    'Demo Admin profile successfully initialized with role="admin"',
    demoAdminProfile.ok && demoAdminProfile.data.role === 'admin',
  );

  const demoOperatorProfile = await upsertUserProfile({
    userId: 'demo-operator-test-id',
    role: 'operator',
    email: 'operator@acmecorp.com',
  });
  assert(
    'Demo Operator profile successfully initialized with role="operator"',
    demoOperatorProfile.ok && demoOperatorProfile.data.role === 'operator',
  );

  // ---------------------------------------------------------------------------
  // 4. Admin Manual Override on HUMAN_REVIEW Cases
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. HUMAN_REVIEW MANUAL OVERRIDE ACTION & AUDIT TRAIL ---');

  const testInvoiceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  // 4.1 Admin performs override
  const overrideRes = await overrideInvoiceStatus({
    invoiceId: testInvoiceId,
    newStatus: 'in_recovery',
    adminActor: 'admin@recoverai.local',
    reason: 'Approved settlement after manual credit check.',
  });

  assert(
    'Admin manual override updates invoice status to "in_recovery"',
    overrideRes.ok && overrideRes.data.status === 'in_recovery',
  );

  // 4.2 Verify policy engine is never bypassed for automatic execution
  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'dispute',
      promisedAmountInr: null,
      promisedAmountPaise: null,
      promisedDate: null,
      disputePresent: true,
      confidence: 0.95,
      rationale: 'Dispute present',
      evidence: 'Dispute quote',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Frozen Core Guardrail: Dispute intent STRICTLY resolves to HUMAN_REVIEW (never AUTO_RECOVER)',
    policyRes.decision === 'HUMAN_REVIEW',
    `Reason: ${policyRes.reason}`,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P1 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1AuthTests().catch((err) => {
  console.error('Fatal error during Phase 1 test run:', err);
  process.exit(1);
});
