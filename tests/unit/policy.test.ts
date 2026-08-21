import { evaluatePolicy } from '../../src/lib/policy';
import type { ExtractedIntent } from '../../src/lib/ai-schema';

function runPolicyEngineTests(): void {
  console.log('=== RecoverAI: Policy Decision Matrix & Guardrail Unit Tests ===\n');

  let passed = 0;
  let failed = 0;

  function assertDecision(
    testName: string,
    params: { extraction: unknown; outstandingAmountPaise: number },
    expectedDecision: 'AUTO_RECOVER' | 'HUMAN_REVIEW',
    expectedAmountPaise: number | null,
    expectedGuardrail?: string,
  ): void {
    try {
      const result = evaluatePolicy(params);
      const decisionMatches = result.decision === expectedDecision;
      const amountMatches = result.approvedAmountPaise === expectedAmountPaise;
      const guardrailMatches = expectedGuardrail
        ? result.guardrailTriggered === expectedGuardrail
        : true;

      if (decisionMatches && amountMatches && guardrailMatches) {
        console.log(`  ✅ PASS: ${testName}`);
        console.log(
          `     -> Decision: ${result.decision} | Approved Paise: ${result.approvedAmountPaise ?? 'null'} | Reason: ${result.reason}`,
        );
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${testName}`);
        console.error(
          `     Received: decision=${result.decision}, amount=${result.approvedAmountPaise}, guardrail=${result.guardrailTriggered}`,
        );
        console.error(
          `     Expected: decision=${expectedDecision}, amount=${expectedAmountPaise}, guardrail=${expectedGuardrail ?? 'N/A'}`,
        );
        failed++;
      }
    } catch (err: unknown) {
      console.error(`  ❌ CRASH FAIL (Policy engine must never throw): ${testName}`, err);
      failed++;
    }
  }

  const baseFullPayment: ExtractedIntent = {
    intent: 'full_payment',
    promisedAmountInr: 15000,
    promisedAmountPaise: 1500000,
    promisedDate: '2026-08-25',
    disputePresent: false,
    confidence: 0.95,
    rationale: 'Full payment promised',
    evidence: 'full payment of Rs 15000',
    resolvedFromPercentage: false,
  };

  const basePartialPayment: ExtractedIntent = {
    intent: 'partial_payment',
    promisedAmountInr: 5000,
    promisedAmountPaise: 500000,
    promisedDate: '2026-08-25',
    disputePresent: false,
    confidence: 0.9,
    rationale: 'Partial payment promised',
    evidence: 'will pay 5000',
    resolvedFromPercentage: false,
  };

  console.log('--- POLICY DECISION MATRIX (PRD Section 3.11) ---');

  // Matrix Row 1: Full payment happy path -> AUTO_RECOVER
  assertDecision(
    'Matrix Row 1: full_payment intent, no dispute, valid amount -> AUTO_RECOVER',
    { extraction: baseFullPayment, outstandingAmountPaise: 1500000 },
    'AUTO_RECOVER',
    1500000,
  );

  // Matrix Row 2: Partial payment happy path -> AUTO_RECOVER
  assertDecision(
    'Matrix Row 2: partial_payment intent, no dispute, valid amount < outstanding -> AUTO_RECOVER',
    { extraction: basePartialPayment, outstandingAmountPaise: 1500000 },
    'AUTO_RECOVER',
    500000,
  );

  // Matrix Row 3: Dispute intent -> HUMAN_REVIEW (Guardrail C)
  assertDecision(
    'Matrix Row 3: dispute intent -> HUMAN_REVIEW (Guardrail C)',
    {
      extraction: { ...baseFullPayment, intent: 'dispute' },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_C_DISPUTE_DETECTED',
  );

  // Matrix Row 4: dispute_present = true -> HUMAN_REVIEW (Guardrail C)
  assertDecision(
    'Matrix Row 4: dispute_present = true with full_payment intent -> HUMAN_REVIEW (Guardrail C)',
    {
      extraction: { ...baseFullPayment, disputePresent: true },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_C_DISPUTE_DETECTED',
  );

  // Matrix Row 5: extension intent -> HUMAN_REVIEW
  assertDecision(
    'Matrix Row 5: extension intent -> HUMAN_REVIEW',
    {
      extraction: { ...baseFullPayment, intent: 'extension', promisedAmountPaise: null },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_EXTENSION_REQUESTED',
  );

  // Matrix Row 6: unknown intent -> HUMAN_REVIEW
  assertDecision(
    'Matrix Row 6: unknown intent -> HUMAN_REVIEW',
    {
      extraction: { ...baseFullPayment, intent: 'unknown' },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_D_UNKNOWN_INTENT',
  );

  // Matrix Row 7: Low confidence (< 0.70) -> HUMAN_REVIEW
  assertDecision(
    'Matrix Row 7: confidence = 0.65 (< 0.70) -> HUMAN_REVIEW',
    {
      extraction: { ...baseFullPayment, confidence: 0.65 },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_D_LOW_CONFIDENCE',
  );

  // Matrix Row 8: Partial payment missing promised amount -> HUMAN_REVIEW
  assertDecision(
    'Matrix Row 8: partial_payment intent with null promised amount -> HUMAN_REVIEW',
    {
      extraction: { ...basePartialPayment, promisedAmountPaise: null, promisedAmountInr: null },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_B_NON_POSITIVE_AMOUNT',
  );

  // Matrix Row 9: Malformed / null extraction -> HUMAN_REVIEW (Guardrail E - Never throw)
  assertDecision(
    'Matrix Row 9: malformed extraction = null -> HUMAN_REVIEW (Guardrail E)',
    { extraction: null, outstandingAmountPaise: 1500000 },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_E_MALFORMED_INPUT',
  );

  console.log('\n--- BOUNDARY & ADVERSARIAL CASES ---');

  // Boundary 1: Amount exactly equal to outstanding -> AUTO_RECOVER
  assertDecision(
    'Boundary 1: amount == outstanding (1,500,000 paise) -> AUTO_RECOVER',
    { extraction: baseFullPayment, outstandingAmountPaise: 1500000 },
    'AUTO_RECOVER',
    1500000,
  );

  // Boundary 2: Amount = 0 paise -> HUMAN_REVIEW (Guardrail B)
  assertDecision(
    'Boundary 2: amount = 0 paise -> HUMAN_REVIEW (Guardrail B)',
    {
      extraction: { ...basePartialPayment, promisedAmountPaise: 0, promisedAmountInr: 0 },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_B_NON_POSITIVE_AMOUNT',
  );

  // Boundary 3: Amount = outstanding + 1 paise (e.g. ₹15,000.01) -> HUMAN_REVIEW (Guardrail A)
  assertDecision(
    'Boundary 3: amount = outstanding + 1 paise (1,500,001 paise) -> HUMAN_REVIEW (Guardrail A)',
    {
      extraction: { ...baseFullPayment, promisedAmountPaise: 1500001, promisedAmountInr: 15000.01 },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_A_OVER_OUTSTANDING_AMOUNT',
  );

  // Boundary 4: Negative amount -> HUMAN_REVIEW (Guardrail B)
  assertDecision(
    'Boundary 4: amount = -500 paise -> HUMAN_REVIEW (Guardrail B)',
    {
      extraction: { ...basePartialPayment, promisedAmountPaise: -500, promisedAmountInr: -5 },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_B_NON_POSITIVE_AMOUNT',
  );

  // Boundary 5: Confidence exactly 0.70 -> AUTO_RECOVER
  assertDecision(
    'Boundary 5: confidence = 0.70 (exact threshold) -> AUTO_RECOVER',
    {
      extraction: { ...baseFullPayment, confidence: 0.7 },
      outstandingAmountPaise: 1500000,
    },
    'AUTO_RECOVER',
    1500000,
  );

  // Boundary 6: Confidence 0.69 (just below threshold) -> HUMAN_REVIEW
  assertDecision(
    'Boundary 6: confidence = 0.69 (just below threshold) -> HUMAN_REVIEW',
    {
      extraction: { ...baseFullPayment, confidence: 0.69 },
      outstandingAmountPaise: 1500000,
    },
    'HUMAN_REVIEW',
    null,
    'GUARDRAIL_D_LOW_CONFIDENCE',
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPolicyEngineTests();
