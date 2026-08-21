import { extractPaymentIntent } from '../src/lib/ai';
import { evaluatePolicy } from '../src/lib/policy';

interface DemoStep {
  readonly name: string;
  readonly emailBody: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly outstandingAmountPaise: number;
  readonly dueDate: string;
  readonly expectedDecision: 'AUTO_RECOVER' | 'HUMAN_REVIEW';
  readonly expectedGuardrail?: string;
  readonly description: string;
}

const DEMO_STEPS: ReadonlyArray<DemoStep> = [
  {
    name: 'Happy Path — Full Payment Commitment',
    description: 'Segment 2: AI extracts full_payment, all 8 guardrails pass → AUTO_RECOVER payment link issued',
    emailBody: `Hi Accounts Team,

We received your reminder for INV-2026-001. Our Finance team has approved 
the full payment of Rs 15,000 to be transferred on August 25th, 2026.

Regards,
Acme Finance`,
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corporation',
    outstandingAmountPaise: 1500000, // ₹15,000.00
    dueDate: '2026-08-20',
    expectedDecision: 'AUTO_RECOVER',
  },
  {
    name: 'Safety Demo — Overpayment Attack (Guardrail A)',
    description: 'Segment 3: AI extracts ₹10,00,000 on a ₹15,000 invoice → Guardrail A blocks → HUMAN_REVIEW',
    emailBody: `Hi Team,

We will transfer 1,000,000 INR for invoice INV-2026-001 immediately. 
Please issue the payment link for 1,000,000 INR.

Regards,
Acme Finance`,
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corporation',
    outstandingAmountPaise: 1500000,
    dueDate: '2026-08-20',
    expectedDecision: 'HUMAN_REVIEW',
    expectedGuardrail: 'GUARDRAIL_A',
  },
  {
    name: 'Safety Demo — Billing Dispute (Guardrail C)',
    description: 'Segment 4: Explicit dispute detected → Guardrail C fires first → HUMAN_REVIEW, no payment link',
    emailBody: `We are disputing invoice INV-2026-001. The rate quoted was ₹10,000 
but you billed us ₹15,000. We will NOT pay until corrected.`,
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corporation',
    outstandingAmountPaise: 1500000,
    dueDate: '2026-08-20',
    expectedDecision: 'HUMAN_REVIEW',
    expectedGuardrail: 'GUARDRAIL_C',
  },
  {
    name: 'Happy Path — Partial Payment 50%',
    description: 'Segment 2 alt: AI resolves 50% to deterministic paise → AUTO_RECOVER for ₹30,000',
    emailBody: `Hello, regarding invoice INV-2026-003, we can clear 50% of the balance today. 
Please send us the payment link for half the amount and we will process it immediately.`,
    invoiceNumber: 'INV-2026-003',
    customerName: 'Global Logistics Ltd',
    outstandingAmountPaise: 6000000, // ₹60,000.00
    dueDate: '2026-08-10',
    expectedDecision: 'AUTO_RECOVER',
  },
];

async function runDemoRehearsal(runNumber: number): Promise<Map<string, string>> {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  DEMO REHEARSAL — RUN ${runNumber}`);
  console.log(`${'='.repeat(72)}\n`);

  const decisionMap = new Map<string, string>();
  let stepsPassed = 0;

  for (const step of DEMO_STEPS) {
    console.log(`\n--- ${step.name} ---`);
    console.log(`    ${step.description}`);

    const aiResult = await extractPaymentIntent({
      emailBody: step.emailBody,
      invoiceNumber: step.invoiceNumber,
      customerName: step.customerName,
      outstandingAmountPaise: step.outstandingAmountPaise,
      dueDate: step.dueDate,
    });

    let policyResult;
    if (aiResult.ok) {
      policyResult = evaluatePolicy({
        extraction: aiResult.data,
        outstandingAmountPaise: step.outstandingAmountPaise,
      });
    } else {
      // Fail closed — AI unavailable
      policyResult = {
        decision: 'HUMAN_REVIEW' as const,
        reason: `AI unavailable: ${aiResult.error.message}`,
        approvedAmountPaise: null,
        approvedAmountInr: null,
        guardrailTriggered: 'GUARDRAIL_E_AI_ERROR' as const,
      };
    }

    const intent = aiResult.ok ? aiResult.data.intent : 'error';
    const amountInr = aiResult.ok ? aiResult.data.promisedAmountInr : null;
    const decisionKey = `${step.name}::decision`;
    const decisonStr = policyResult.decision;
    decisionMap.set(decisionKey, decisonStr);

    const passesDecision = policyResult.decision === step.expectedDecision;
    const passesGuardrail = step.expectedGuardrail
      ? String(policyResult.guardrailTriggered ?? '').startsWith(step.expectedGuardrail)
      : true;
    const passed = passesDecision && passesGuardrail;

    if (passed) {
      console.log(`    ✅ PASS`);
      stepsPassed++;
    } else {
      console.error(`    ❌ FAIL`);
    }

    console.log(`    Intent            : ${intent}`);
    console.log(`    Promised Amount   : ${amountInr !== null ? `₹${amountInr.toFixed(2)}` : 'null'}`);
    console.log(`    Decision          : ${policyResult.decision} (expected: ${step.expectedDecision})`);
    if (policyResult.guardrailTriggered) {
      console.log(`    Guardrail         : ${policyResult.guardrailTriggered}`);
    }
    console.log(`    Policy Reason     : ${policyResult.reason}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  RUN ${runNumber} SUMMARY: ${stepsPassed}/${DEMO_STEPS.length} demo steps passed`);
  console.log(`${'='.repeat(72)}\n`);

  return decisionMap;
}

async function runDemoRehearsals(): Promise<void> {
  console.log('=== RecoverAI: Phase 9 Demo Rehearsal Runner ===');
  console.log('Running the live demo scenario twice to verify deterministic, identical results.\n');

  const run1Decisions = await runDemoRehearsal(1);
  const run2Decisions = await runDemoRehearsal(2);

  // Determinism check: compare Run 1 vs Run 2 policy decisions
  console.log('=== DETERMINISM VERIFICATION: Run 1 vs Run 2 Policy Decisions ===\n');

  let isDeterministic = true;

  for (const [key, run1Decision] of run1Decisions) {
    const run2Decision = run2Decisions.get(key);
    const match = run1Decision === run2Decision;

    if (!match) isDeterministic = false;

    const name = key.replace('::decision', '');
    const status = match ? '✅ IDENTICAL' : '❌ DIVERGED';
    console.log(`  ${status}: ${name}`);
    console.log(`    Run 1: ${run1Decision} | Run 2: ${run2Decision ?? 'N/A'}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  DEMO REHEARSAL DETERMINISM: ${isDeterministic ? '✅ PASS — All decisions byte-identical' : '❌ FAIL — Decisions diverged'}`);
  console.log(`${'='.repeat(72)}\n`);

  if (!isDeterministic) {
    process.exit(1);
  }

  console.log('Demo rehearsal complete. Both runs produced identical policy decisions.');
  console.log('System is ready for live demonstration.\n');
}

runDemoRehearsals().catch((err) => {
  console.error('Fatal error in Demo Rehearsal Runner:', err);
  process.exit(1);
});
