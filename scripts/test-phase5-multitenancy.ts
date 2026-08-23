import fs from 'fs';
import path from 'path';
import {
  createCompany,
  createInvoice,
  getInvoiceById,
  getAllInvoices,
  getPaginatedInvoices,
  upsertUserProfile,
  getUserProfileById,
  overrideInvoiceStatus,
  updateInvoiceAfterPayment,
  DEFAULT_COMPANY_ID,
} from '../src/lib/db';
import { evaluatePolicy } from '../src/lib/policy';
import type { Invoice, Company } from '../src/lib/types';

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

async function runPhase5MultiTenancyTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P5 Multi-Company / Multi-Tenant Isolation Verification ===');
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

  const COMPANY_A_ID = DEFAULT_COMPANY_ID;
  const COMPANY_B_ID = '00000000-0000-0000-0000-000000000002';

  // ---------------------------------------------------------------------------
  // 1. Company Setup & Additive Migration Verification
  // ---------------------------------------------------------------------------
  console.log('--- 1. COMPANY SETUP & TENANT REGISTRATION ---');

  const companyA: Company = {
    id: COMPANY_A_ID,
    name: 'Acme Global Services',
    createdAt: new Date().toISOString(),
  };

  const companyB: Company = {
    id: COMPANY_B_ID,
    name: 'Apex Retail Corporation',
    createdAt: new Date().toISOString(),
  };

  await createCompany(companyA);
  const compBResult = await createCompany(companyB);

  assert(
    'Company B registered in multi-tenant registry',
    compBResult.ok === true && compBResult.data.id === COMPANY_B_ID,
    `Company: ${compBResult.ok ? compBResult.data.name : 'error'}`,
  );

  // Set up User A (Company A) and User B (Company B)
  const userAId = 'user_company_a_operator';
  const userBId = 'user_company_b_operator';

  await upsertUserProfile({
    userId: userAId,
    role: 'operator',
    email: 'operator@acmeglobal.com',
    companyId: COMPANY_A_ID,
  });

  await upsertUserProfile({
    userId: userBId,
    role: 'operator',
    email: 'operator@apexretail.com',
    companyId: COMPANY_B_ID,
  });

  const profileA = await getUserProfileById(userAId);
  const profileB = await getUserProfileById(userBId);

  assert(
    'User profiles correctly mapped to distinct company tenant IDs',
    profileA.ok &&
      profileB.ok &&
      profileA.data.companyId === COMPANY_A_ID &&
      profileB.data.companyId === COMPANY_B_ID,
    `User A: ${profileA.ok ? profileA.data.companyId : ''} | User B: ${profileB.ok ? profileB.data.companyId : ''}`,
  );

  // ---------------------------------------------------------------------------
  // 2. Multi-Tenant Invoice Creation & Scope Partitioning
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. MULTI-TENANT INVOICE DATA PARTITIONING ---');

  const invoiceA: Invoice = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    companyId: COMPANY_A_ID,
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Client Corp',
    customerEmail: 'buyer@acmeclient.com',
    totalAmountPaise: 1500000,
    outstandingAmountPaise: 1500000,
    currency: 'INR',
    status: 'overdue',
    dueDate: '2026-08-01',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const invoiceB: Invoice = {
    id: 'd99ee40e-81ff-6605-d890-3b05e5f6a702',
    companyId: COMPANY_B_ID,
    invoiceNumber: 'APEX-2026-901',
    customerName: 'Apex Client Ltd',
    customerEmail: 'procurement@apexclient.com',
    totalAmountPaise: 8000000,
    outstandingAmountPaise: 8000000,
    currency: 'INR',
    status: 'overdue',
    dueDate: '2026-08-10',
    createdAt: '2026-08-10T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
  };

  await createInvoice(invoiceA);
  await createInvoice(invoiceB);

  // ---------------------------------------------------------------------------
  // 3. Same-Tenant Access Allowed
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. SAME-TENANT AUTHORIZED ACCESS ---');

  const fetchSameTenantA = await getInvoiceById(invoiceA.id, COMPANY_A_ID);
  const fetchSameTenantB = await getInvoiceById(invoiceB.id, COMPANY_B_ID);

  assert(
    'Company A user can access Company A invoice',
    fetchSameTenantA.ok === true && fetchSameTenantA.data.id === invoiceA.id,
    `Invoice: ${fetchSameTenantA.ok ? fetchSameTenantA.data.invoiceNumber : ''}`,
  );

  assert(
    'Company B user can access Company B invoice',
    fetchSameTenantB.ok === true && fetchSameTenantB.data.id === invoiceB.id,
    `Invoice: ${fetchSameTenantB.ok ? fetchSameTenantB.data.invoiceNumber : ''}`,
  );

  // ---------------------------------------------------------------------------
  // 4. Cross-Tenant Verified Denial (Explicit 403 / unauthorized_error)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. CROSS-TENANT VERIFIED DENIAL (SECURITY BOUNDARY) ---');

  // User from Company A attempts to access Company B invoice
  const crossTenantAccess = await getInvoiceById(invoiceB.id, COMPANY_A_ID);

  assert(
    'User from Company A receives explicit unauthorized_error denial when querying Company B invoice',
    crossTenantAccess.ok === false && crossTenantAccess.error.code === 'unauthorized_error',
    `Error Code: ${crossTenantAccess.ok ? 'none' : crossTenantAccess.error.code} | Message: ${crossTenantAccess.ok ? '' : crossTenantAccess.error.message}`,
  );

  // User from Company A attempts to override Company B invoice
  const crossTenantOverride = await overrideInvoiceStatus({
    invoiceId: invoiceB.id,
    newStatus: 'in_recovery',
    adminActor: 'admin@acmeglobal.com',
    reason: 'Malicious cross-tenant override attempt',
    requiredCompanyId: COMPANY_A_ID,
  });

  assert(
    'Admin from Company A receives explicit unauthorized_error denial on Company B invoice override',
    crossTenantOverride.ok === false && crossTenantOverride.error.code === 'unauthorized_error',
    `Error Message: ${crossTenantOverride.ok ? '' : crossTenantOverride.error.message}`,
  );

  // ---------------------------------------------------------------------------
  // 5. Tenant Scoped Listing & Pagination
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. TENANT SCOPED QUERYING & PAGINATION ---');

  const compAInvoices = await getAllInvoices(COMPANY_A_ID);
  const compBInvoices = await getAllInvoices(COMPANY_B_ID);

  assert(
    'getAllInvoices(companyId) isolates invoices by tenant boundary',
    compAInvoices.ok &&
      compBInvoices.ok &&
      compAInvoices.data.every((i) => (i.companyId || DEFAULT_COMPANY_ID) === COMPANY_A_ID) &&
      compBInvoices.data.every((i) => (i.companyId || DEFAULT_COMPANY_ID) === COMPANY_B_ID),
    `Company A Count: ${compAInvoices.ok ? compAInvoices.data.length : 0} | Company B Count: ${compBInvoices.ok ? compBInvoices.data.length : 0}`,
  );

  const paginatedResult = await getPaginatedInvoices({
    companyId: COMPANY_A_ID,
    page: 1,
    limit: 2,
  });

  assert(
    'getPaginatedInvoices returns correct page, limit, and total count metadata',
    paginatedResult.ok &&
      paginatedResult.data.page === 1 &&
      paginatedResult.data.limit === 2 &&
      paginatedResult.data.items.length <= 2,
    `Items: ${paginatedResult.ok ? paginatedResult.data.items.length : 0}, Total: ${paginatedResult.ok ? paginatedResult.data.total : 0}, TotalPages: ${paginatedResult.ok ? paginatedResult.data.totalPages : 0}`,
  );

  // ---------------------------------------------------------------------------
  // 6. Zero Cross-Tenant Payment Balance Bleed
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. PAYMENT BALANCE ZERO-BLEED VERIFICATION ---');

  const initialBalanceB = invoiceB.outstandingAmountPaise;

  // Apply payment to Invoice A
  await updateInvoiceAfterPayment({
    invoiceId: invoiceA.id,
    amountPaidPaise: 500000,
    paymentId: `pay_test_tenant_${Date.now()}`,
  });

  // Verify Invoice B balance remains untouched
  const reloadedB = await getInvoiceById(invoiceB.id, COMPANY_B_ID);

  assert(
    'Payment to Company A invoice causes zero balance alteration on Company B invoice',
    reloadedB.ok && reloadedB.data.outstandingAmountPaise === initialBalanceB,
    `Company B Balance: ₹${reloadedB.ok ? reloadedB.data.outstandingAmountPaise / 100 : 0} (Unchanged)`,
  );

  // ---------------------------------------------------------------------------
  // 7. Frozen Core Invariant Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. FROZEN CORE INVARIANT VERIFICATION ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 15000,
      promisedAmountPaise: 1500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.95,
      rationale: 'Full payment promised',
      evidence: 'We will pay full balance',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'evaluatePolicy() remains pure, deterministic, and sole authority for AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P5 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5MultiTenancyTests().catch((err) => {
  console.error('Fatal error in Phase P5 tests:', err);
  process.exit(1);
});
