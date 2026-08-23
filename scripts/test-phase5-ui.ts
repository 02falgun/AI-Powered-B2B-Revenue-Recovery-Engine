import { getAuditLogsForInvoice } from '../src/lib/db';
import { evaluatePolicy } from '../src/lib/policy';

async function runPhase5UITests(): Promise<void> {
  console.log('=== RecoverAI: Phase 5 Dashboard & Audit Trail UI Verification ===\n');

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

  const testInvoiceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  // 1. Audit Logs Read API Verification
  console.log('1. Verifying Audit Logs Read API function...');
  const logsResult = await getAuditLogsForInvoice(testInvoiceId);
  assert('getAuditLogsForInvoice returns ok: true', logsResult.ok === true);
  if (logsResult.ok) {
    console.log(
      `   Found ${logsResult.data.length} audit log entries for invoice ${testInvoiceId}`,
    );
  }

  // 2. Demo Shortcut Preset #1: Partial Payment (50%) Policy Check
  console.log('\n2. Testing Demo Shortcut #1 (Partial Payment 50%)...');
  const shortcut1Policy = evaluatePolicy({
    extraction: {
      intent: 'partial_payment',
      promisedAmountInr: 7500,
      promisedAmountPaise: 750000,
      promisedDate: null,
      disputePresent: false,
      confidence: 0.9,
      rationale: 'Buyer commits to 50% partial payment',
      evidence: '50% of the balance today',
      resolvedFromPercentage: true,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Partial Payment 50% evaluates to AUTO_RECOVER',
    shortcut1Policy.decision === 'AUTO_RECOVER',
  );
  assert(
    'Approved amount is exactly 750,000 paise (₹7,500.00)',
    shortcut1Policy.approvedAmountPaise === 750000,
  );

  // 3. Demo Shortcut Preset #2: Billing Dispute Policy Check
  console.log('\n3. Testing Demo Shortcut #2 (Billing Dispute)...');
  const shortcut2Policy = evaluatePolicy({
    extraction: {
      intent: 'dispute',
      promisedAmountInr: null,
      promisedAmountPaise: null,
      promisedDate: null,
      disputePresent: true,
      confidence: 0.95,
      rationale: 'Buyer disputes billing rate',
      evidence: 'We are disputing this invoice',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Billing Dispute evaluates to HUMAN_REVIEW (Guardrail C)',
    shortcut2Policy.decision === 'HUMAN_REVIEW',
  );
  assert('No payment amount approved', shortcut2Policy.approvedAmountPaise === null);

  // 4. Demo Shortcut Preset #3: Overpayment Attempt Policy Check
  console.log('\n4. Testing Demo Shortcut #3 (Overpayment Attempt - Guardrail A)...');
  const shortcut3Policy = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 1000000,
      promisedAmountPaise: 100000000, // 1,000,000 INR
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.9,
      rationale: 'Buyer offers overpayment of 1,000,000 INR',
      evidence: 'transfer 1,000,000 INR',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000, // 15,000 INR balance
  });

  assert(
    'Overpayment attempt evaluates to HUMAN_REVIEW (Guardrail A triggered)',
    shortcut3Policy.decision === 'HUMAN_REVIEW',
  );
  assert(
    'Guardrail A flagged in output',
    String(shortcut3Policy.guardrailTriggered).startsWith('GUARDRAIL_A'),
  );
  assert(
    'shortcut3Policy includes exactly 8 guardrailResults',
    Array.isArray(shortcut3Policy.guardrailResults) && shortcut3Policy.guardrailResults.length === 8,
  );

  const guardrailA = shortcut3Policy.guardrailResults?.find((g) => g.id === 'A');
  assert(
    'Overpayment case explicitly marks Guardrail A (Outstanding Cap) as failed (passed=false, evaluated=true)',
    guardrailA !== undefined && guardrailA.passed === false && guardrailA.evaluated === true,
  );

  const guardrailC = shortcut2Policy.guardrailResults?.find((g) => g.id === 'C');
  assert(
    'Dispute case explicitly marks Guardrail C (Dispute Filter) as failed (passed=false, evaluated=true)',
    guardrailC !== undefined && guardrailC.passed === false && guardrailC.evaluated === true,
  );

  const guardrailF_in_dispute = shortcut2Policy.guardrailResults?.find((g) => g.id === 'F');
  assert(
    'Subsequent guardrails in short-circuit failure mark evaluated=false (Not Evaluated/Idle)',
    guardrailF_in_dispute !== undefined && guardrailF_in_dispute.evaluated === false,
  );

  const idleCountInDispute = shortcut2Policy.guardrailResults?.filter((g) => !g.evaluated).length;
  assert(
    'Dispute case short-circuits to exactly 1 failed guardrail (C) and 7 idle guardrails (A, B, D, E, F, G, H)',
    idleCountInDispute === 7,
  );

  const allPassed = shortcut1Policy.guardrailResults?.every((g) => g.passed && g.evaluated);
  assert(
    'AUTO_RECOVER case marks all 8 guardrails as passed=true and evaluated=true',
    allPassed === true,
  );

  console.log(`\n================================================================================`);
  console.log(`PHASE 5 VERIFICATION RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5UITests().catch((err) => {
  console.error('Fatal error in Phase 5 UI verification:', err);
  process.exit(1);
});
