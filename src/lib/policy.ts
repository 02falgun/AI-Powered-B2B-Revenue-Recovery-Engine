/**
 * ============================================================================
 * RECOVERAI POLICY ENGINE — ARCHITECTURAL INVARIANT (GUARDRAIL F)
 * ============================================================================
 *
 * INVARIANT: evaluatePolicy() in this file is the SINGLE AND SOLE AUTHORITY
 * in the entire codebase allowed to return decision = 'AUTO_RECOVER'.
 *
 * No API handler, background task, database trigger, or UI component is permitted
 * to create a payment link or synthesize an 'AUTO_RECOVER' decision without
 * passing through evaluatePolicy() first.
 *
 * PURE LOGIC RULES:
 * 1. This module MUST NEVER import HTTP clients or SDKs (OpenAI, Razorpay, Supabase).
 * 2. Zero side-effects, zero randomness, zero wall-clock dependencies.
 * 3. Fail closed: Any malformed, uncertain, or boundary-violating input resolves
 *    to 'HUMAN_REVIEW' safely without throwing exceptions.
 * 4. Money arithmetic operates strictly in integer paise (1 INR = 100 paise).
 * ============================================================================
 */

import type { ExtractedIntent } from './ai-schema';

// Named policy constants (No magic numbers)
export const ZERO_PAISE = 0;
export const MINIMUM_CONFIDENCE_THRESHOLD = 0.7;

export type PolicyDecisionType = 'AUTO_RECOVER' | 'HUMAN_REVIEW';

export interface PolicyDecision {
  readonly decision: PolicyDecisionType;
  readonly reason: string;
  readonly approvedAmountPaise: number | null;
  readonly approvedAmountInr: number | null;
  readonly guardrailTriggered?: string;
}

export interface EvaluatePolicyParams {
  readonly extraction: ExtractedIntent | unknown;
  readonly outstandingAmountPaise: number;
}

/**
 * GUARDRAIL C: Unconditional Dispute Check.
 * If dispute_present === true OR intent === 'dispute', route to HUMAN_REVIEW
 * unconditionally BEFORE any other check runs.
 */
export function guardrailCheckDispute(
  extraction: Partial<ExtractedIntent> | null | undefined,
): PolicyDecision | null {
  if (!extraction) {
    return null;
  }

  if (extraction.disputePresent === true || extraction.intent === 'dispute') {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Dispute present or dispute intent detected in buyer communication.',
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_C_DISPUTE_DETECTED',
    };
  }

  return null;
}

/**
 * GUARDRAIL E & D: Input Sanity & Completeness Check.
 * Rejects missing/malformed objects, unknown intents, low confidence (< 0.70),
 * or missing promised amounts safely without throwing.
 */
export function guardrailCheckSanityAndCompleteness(
  extraction: unknown,
  outstandingAmountPaise: number,
): PolicyDecision | null {
  if (
    typeof extraction !== 'object' ||
    extraction === null ||
    !Number.isInteger(outstandingAmountPaise) ||
    outstandingAmountPaise <= ZERO_PAISE
  ) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Invalid or malformed policy evaluation parameters.',
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_E_MALFORMED_INPUT',
    };
  }

  const ext = extraction as Partial<ExtractedIntent>;

  if (!ext.intent || ext.intent === 'unknown') {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Intent classification is unknown or ambiguous.',
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_D_UNKNOWN_INTENT',
    };
  }

  if (typeof ext.confidence !== 'number' || ext.confidence < MINIMUM_CONFIDENCE_THRESHOLD) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: `Extraction confidence score (${ext.confidence ?? 0}) is below minimum policy threshold (${MINIMUM_CONFIDENCE_THRESHOLD}).`,
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_D_LOW_CONFIDENCE',
    };
  }

  return null;
}

/**
 * Extension Intent Check:
 * Extension requests without an immediate payment commitment route to HUMAN_REVIEW.
 */
export function guardrailCheckExtension(
  extraction: Partial<ExtractedIntent>,
): PolicyDecision | null {
  if (extraction.intent === 'extension') {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Payment deadline extension requested without immediate payment commitment.',
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_EXTENSION_REQUESTED',
    };
  }

  return null;
}

/**
 * GUARDRAIL B: Non-Positive Amount Check.
 * Rejects any payment proposal where approved amount is <= 0 paise.
 */
export function guardrailCheckNonPositiveAmount(
  approvedAmountPaise: number | null | undefined,
): PolicyDecision | null {
  if (
    approvedAmountPaise === null ||
    approvedAmountPaise === undefined ||
    !Number.isInteger(approvedAmountPaise) ||
    approvedAmountPaise <= ZERO_PAISE
  ) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: 'Approved payment amount must be a positive integer in paise.',
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_B_NON_POSITIVE_AMOUNT',
    };
  }

  return null;
}

/**
 * GUARDRAIL A: Over-Outstanding Amount Check.
 * Rejects if approved amount exceeds the outstanding balance.
 */
export function guardrailCheckOverAmount(
  approvedAmountPaise: number,
  outstandingAmountPaise: number,
): PolicyDecision | null {
  if (approvedAmountPaise > outstandingAmountPaise) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: `Approved payment amount (${approvedAmountPaise} paise) exceeds total outstanding balance (${outstandingAmountPaise} paise).`,
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_A_OVER_OUTSTANDING_AMOUNT',
    };
  }

  return null;
}

/**
 * Master Policy Evaluator Function.
 *
 * ARCHITECTURAL INVARIANT: This function is the ONLY function in the codebase
 * authorized to return decision = 'AUTO_RECOVER'.
 *
 * Money correctness: All amount comparisons operate strictly in integer paise.
 * Fail-Closed: Any uncertain state or policy violation yields 'HUMAN_REVIEW'.
 */
export function evaluatePolicy(params: EvaluatePolicyParams): PolicyDecision {
  try {
    const { extraction, outstandingAmountPaise } = params;

    // 1. Guardrail C: Unconditional Dispute Check (Runs FIRST)
    const disputeDecision = guardrailCheckDispute(extraction as Partial<ExtractedIntent>);
    if (disputeDecision) {
      return disputeDecision;
    }

    // 2. Guardrail E & D: Input Sanity & Completeness Check
    const sanityDecision = guardrailCheckSanityAndCompleteness(extraction, outstandingAmountPaise);
    if (sanityDecision) {
      return sanityDecision;
    }

    const ext = extraction as ExtractedIntent;

    // 3. Extension Intent Routing
    const extensionDecision = guardrailCheckExtension(ext);
    if (extensionDecision) {
      return extensionDecision;
    }

    // Determine target payment amount in paise
    let targetAmountPaise: number | null = ext.promisedAmountPaise;

    // For full_payment intent, if promisedAmountPaise is null, default to total outstanding balance
    if (
      ext.intent === 'full_payment' &&
      (targetAmountPaise === null || targetAmountPaise === undefined)
    ) {
      targetAmountPaise = outstandingAmountPaise;
    }

    // 4. Guardrail B: Non-Positive Amount Check
    const nonPositiveDecision = guardrailCheckNonPositiveAmount(targetAmountPaise);
    if (nonPositiveDecision) {
      return nonPositiveDecision;
    }

    const validAmountPaise = targetAmountPaise as number;

    // 5. Guardrail A: Over-Outstanding Amount Check
    const overAmountDecision = guardrailCheckOverAmount(validAmountPaise, outstandingAmountPaise);
    if (overAmountDecision) {
      return overAmountDecision;
    }

    // All guardrails passed! Approve AUTO_RECOVER.
    const approvedAmountInr = validAmountPaise / 100;

    return {
      decision: 'AUTO_RECOVER',
      reason: `Policy approved AUTO_RECOVER for ${ext.intent} of ₹${approvedAmountInr.toFixed(2)} (${validAmountPaise} paise).`,
      approvedAmountPaise: validAmountPaise,
      approvedAmountInr,
    };
  } catch (err: unknown) {
    // Fail-Closed: Never leak uncaught exceptions out of evaluatePolicy()
    const message =
      err instanceof Error ? err.message : 'Unknown exception during policy evaluation';
    return {
      decision: 'HUMAN_REVIEW',
      reason: `Internal policy evaluation exception: ${message}`,
      approvedAmountPaise: null,
      approvedAmountInr: null,
      guardrailTriggered: 'GUARDRAIL_E_EXCEPTION_SAFETY_NET',
    };
  }
}
