import { z } from 'zod';
import type { Result, AppError } from './types';

export const IntentEnum = z.enum([
  'partial_payment',
  'full_payment',
  'dispute',
  'extension',
  'unknown',
]);

export type IntentType = z.infer<typeof IntentEnum>;

/**
 * Zod schema matching SRS Section 4.5 for OpenAI Structured Outputs.
 */
export const ExtractionSchema = z.object({
  intent: IntentEnum,
  promised_amount_inr: z
    .number()
    .nullable()
    .describe('Promised amount in INR, or null if percentage/unspecified.'),
  promised_date: z
    .string()
    .nullable()
    .describe('Promised payment date in YYYY-MM-DD format, or null.'),
  dispute_present: z
    .boolean()
    .describe('True if buyer disputes invoice validity, amount, or quality.'),
  confidence: z.number().min(0).max(1).describe('Extraction confidence score between 0.0 and 1.0.'),
  rationale: z.string().describe('Explanation for the extracted intent.'),
  evidence: z.string().describe('Exact quote from buyer email supporting extraction.'),
});

export type RawExtraction = z.infer<typeof ExtractionSchema>;

export interface ExtractedIntent {
  readonly intent: IntentType;
  readonly promisedAmountInr: number | null;
  readonly promisedAmountPaise: number | null;
  readonly promisedDate: string | null;
  readonly disputePresent: boolean;
  readonly confidence: number;
  readonly rationale: string;
  readonly evidence: string;
  readonly resolvedFromPercentage: boolean;
}

/**
 * Server-side post-processing & sanitization function.
 *
 * Money correctness & security:
 * 1. Re-validates raw LLM fields using Zod.
 * 2. Clamps confidence between 0.0 and 1.0.
 * 3. Deterministically resolves percentage commitments (e.g. "50% today") in code using outstandingAmountPaise.
 * 4. Ensures promisedAmountPaise never exceeds outstandingAmountPaise.
 */
export function validateAndSanitizeExtraction(
  rawInput: unknown,
  outstandingAmountPaise: number,
): Result<ExtractedIntent, AppError> {
  const parseResult = ExtractionSchema.safeParse(rawInput);

  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: 'LLM output failed Zod schema validation.',
        details: { issues: parseResult.error.issues },
      },
    };
  }

  const raw = parseResult.data;

  // Clamp confidence to strict 0.0 - 1.0 range
  const confidence = Math.min(1.0, Math.max(0.0, raw.confidence));

  let promisedAmountInr = raw.promised_amount_inr;
  let promisedAmountPaise: number | null = null;
  let resolvedFromPercentage = false;

  const combinedText = `${raw.rationale} ${raw.evidence}`.toLowerCase();

  // Deterministically resolve percentage commitments in backend code
  if (promisedAmountInr === null) {
    const percentageMatch = combinedText.match(/(\d+(?:\.\d+)?)%\s*(?:today|now|this week|by|of)?/);
    const halfMatch = combinedText.match(/\b(half|50%)\b/);

    let percentValue: number | null = null;
    if (percentageMatch && percentageMatch[1]) {
      percentValue = parseFloat(percentageMatch[1]);
    } else if (halfMatch) {
      percentValue = 50;
    }

    if (percentValue !== null && percentValue > 0 && percentValue <= 100) {
      promisedAmountPaise = Math.round((outstandingAmountPaise * percentValue) / 100);
      promisedAmountInr = promisedAmountPaise / 100;
      resolvedFromPercentage = true;
    }
  } else {
    // Convert INR number to integer paise, treating 0 or non-positive as null
    if (promisedAmountInr <= 0) {
      promisedAmountInr = null;
      promisedAmountPaise = null;
    } else {
      promisedAmountPaise = Math.round(promisedAmountInr * 100);
    }
  }

  // Ensure promised amount is non-negative and capped at total outstanding
  if (promisedAmountPaise !== null) {
    if (promisedAmountPaise < 0) {
      promisedAmountPaise = 0;
      promisedAmountInr = 0;
    } else if (promisedAmountPaise > outstandingAmountPaise) {
      // Cap at outstanding balance to prevent over-promise anomalies
      promisedAmountPaise = outstandingAmountPaise;
      promisedAmountInr = outstandingAmountPaise / 100;
    }
  }

  // Validate ISO date format YYYY-MM-DD
  let promisedDate: string | null = raw.promised_date;
  if (promisedDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(promisedDate) || isNaN(Date.parse(promisedDate))) {
      promisedDate = null;
    }
  }

  return {
    ok: true,
    data: {
      intent: raw.intent,
      promisedAmountInr,
      promisedAmountPaise,
      promisedDate,
      disputePresent: raw.dispute_present,
      confidence,
      rationale: resolvedFromPercentage
        ? `${raw.rationale} [Backend note: Percentage commitment resolved deterministically in code: ${promisedAmountInr} INR (${promisedAmountPaise} paise)]`
        : raw.rationale,
      evidence: raw.evidence,
      resolvedFromPercentage,
    },
  };
}
