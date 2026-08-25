import fs from 'fs';
import path from 'path';
import { purgeCompanyData, createInvoice, getInvoiceById } from '../src/lib/db';
import { evaluatePolicy } from '../src/lib/policy';
import type { Invoice } from '../src/lib/types';

async function runPhase8LegalTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P8 Legal & Data Handling Verification ===');
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

  // 1. Verify Privacy Policy Documentation
  console.log('--- 1. PRIVACY POLICY DOCUMENTATION ---');

  const privacyPath = path.resolve(process.cwd(), 'docs/privacy-policy.md');
  const privacyExists = fs.existsSync(privacyPath);
  const privacyContent = privacyExists ? fs.readFileSync(privacyPath, 'utf8') : '';

  assert(
    'docs/privacy-policy.md exists',
    privacyExists,
  );

  assert(
    'Privacy policy documents invoice data, ingested email content, and audit logs',
    privacyContent.includes('Invoice Records') &&
      privacyContent.includes('Ingested Email') &&
      privacyContent.includes('Audit Logs'),
  );

  assert(
    'Privacy policy includes DPDP Act considerations with explicit informational disclaimer',
    privacyContent.includes('DPDP') &&
      (privacyContent.includes('informational') || privacyContent.includes('INFORMATIONAL')) &&
      (privacyContent.includes('not legal advice') || privacyContent.includes('NOT LEGAL ADVICE')),
  );

  // 2. Verify Data Retention Policy Documentation
  console.log('\n--- 2. DATA RETENTION POLICY DOCUMENTATION ---');

  const retentionPath = path.resolve(process.cwd(), 'docs/data-retention-policy.md');
  const retentionExists = fs.existsSync(retentionPath);
  const retentionContent = retentionExists ? fs.readFileSync(retentionPath, 'utf8') : '';

  assert(
    'docs/data-retention-policy.md exists',
    retentionExists,
  );

  assert(
    'Retention policy defines retention schedules across tables and systems',
    retentionContent.includes('Retention Schedule') &&
      retentionContent.includes('invoices') &&
      retentionContent.includes('audit_logs'),
  );

  assert(
    'Retention policy documents the admin data-purge procedure and company_id scoping',
    retentionContent.includes('Admin Data Purge') &&
      retentionContent.includes('company_id') &&
      retentionContent.includes('purge-company'),
  );

  // 3. Verify Admin Data Purge Function & Route
  console.log('\n--- 3. ADMIN DATA-PURGE MECHANISM & ISOLATION ---');

  const routePath = path.resolve(process.cwd(), 'src/app/api/admin/purge-company/route.ts');
  const routeExists = fs.existsSync(routePath);
  const routeContent = routeExists ? fs.readFileSync(routePath, 'utf8') : '';

  assert(
    'Admin purge API route src/app/api/admin/purge-company/route.ts exists',
    routeExists,
  );

  assert(
    'Admin purge route enforces requireAdmin and rate-limiting check',
    routeContent.includes('requireAdmin') &&
      routeContent.includes('checkAdminPurgeRateLimit'),
  );

  assert(
    'Admin purge route enforces explicit confirm flag and multi-tenant scoping',
    routeContent.includes('confirm') &&
      routeContent.includes('companyId'),
  );

  // Functional test of purgeCompanyData() isolation
  const testCompanyA = '11111111-1111-1111-1111-111111111111';
  const testCompanyB = '22222222-2222-2222-2222-222222222222';

  const testInvoiceA: Invoice = {
    id: 'test-inv-purge-a',
    companyId: testCompanyA,
    invoiceNumber: 'INV-TEST-PURGE-A',
    customerName: 'Purge Target Corp',
    customerEmail: 'purge@target.com',
    totalAmountPaise: 500000,
    outstandingAmountPaise: 500000,
    currency: 'INR',
    status: 'overdue',
    dueDate: '2026-08-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testInvoiceB: Invoice = {
    id: 'test-inv-purge-b',
    companyId: testCompanyB,
    invoiceNumber: 'INV-TEST-PURGE-B',
    customerName: 'Safe Survivor Corp',
    customerEmail: 'safe@survivor.com',
    totalAmountPaise: 900000,
    outstandingAmountPaise: 900000,
    currency: 'INR',
    status: 'overdue',
    dueDate: '2026-08-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createInvoice(testInvoiceA);
  await createInvoice(testInvoiceB);

  // Execute purge for Company A only
  const purgeResult = await purgeCompanyData(testCompanyA);

  assert(
    'purgeCompanyData() successfully executes for target company',
    purgeResult.ok && purgeResult.data.companyId === testCompanyA,
  );

  // Verify Company A data is gone, but Company B data is preserved
  const getARes = await getInvoiceById('test-inv-purge-a');
  const getBRes = await getInvoiceById('test-inv-purge-b');

  assert(
    'purgeCompanyData() strictly purges target company data and preserves other company data',
    !getARes.ok && getBRes.ok && getBRes.data.companyId === testCompanyB,
    `Company A invoice gone: ${!getARes.ok}, Company B invoice preserved: ${getBRes.ok}`,
  );

  // Clean up test Invoice B
  await purgeCompanyData(testCompanyB);

  // 4. Verify README Links
  console.log('\n--- 4. README DOCUMENTATION LINKS ---');

  const readmePath = path.resolve(process.cwd(), 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');

  assert(
    'README.md links docs/privacy-policy.md',
    readmeContent.includes('docs/privacy-policy.md'),
  );

  assert(
    'README.md links docs/data-retention-policy.md',
    readmeContent.includes('docs/data-retention-policy.md'),
  );

  // 5. Verify Frozen Core Determinism Invariant
  console.log('\n--- 5. FROZEN CORE DETERMINISM INVARIANT ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 25000,
      promisedAmountPaise: 2500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.98,
      rationale: 'Legitimate full payment commitment',
      evidence: 'Paying full balance today',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 2500000,
  });

  assert(
    'evaluatePolicy() remains pure, deterministic, and sole authority for AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 2500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P8 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8LegalTests().catch((err) => {
  console.error('Fatal error in Phase P8 tests:', err);
  process.exit(1);
});
