import { NextResponse } from 'next/server';
import { getInvoiceById, insertAuditLog } from '@/lib/db';
import { extractPaymentIntent } from '@/lib/ai';
import { evaluatePolicy } from '@/lib/policy';
import { createTestPaymentLink } from '@/lib/razorpay';
import type { ExtractedIntent } from '@/lib/ai-schema';

export interface ProcessEmailRequestBody {
  readonly invoice_id?: string;
  readonly email_text?: string;
}

/**
 * Core Orchestration API Route — Phase 3.
 *
 * Sequence:
 * 1. Input validation.
 * 2. Supabase DB invoice lookup for authoritative outstanding balance.
 * 3. AI intent extraction (lib/ai.ts).
 * 4. Deterministic policy evaluation (lib/policy.ts).
 * 5. If AUTO_RECOVER: Razorpay Test Payment Link creation (lib/razorpay.ts).
 * 6. Mandatory audit logging (audit_logs table).
 * 7. Typed JSON response with explicit failure modes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: ProcessEmailRequestBody;
  try {
    body = (await request.json()) as ProcessEmailRequestBody;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON body';
    return NextResponse.json(
      {
        success: false,
        failureCode: 'validation_error',
        error: { code: 'validation_error', message: `Malformed request JSON: ${message}` },
      },
      { status: 400 },
    );
  }

  const invoiceId = body.invoice_id?.trim();
  const emailText = body.email_text?.trim();

  if (!invoiceId || !emailText) {
    return NextResponse.json(
      {
        success: false,
        failureCode: 'validation_error',
        error: {
          code: 'validation_error',
          message: 'Both invoice_id and email_text are required parameters.',
        },
      },
      { status: 400 },
    );
  }

  // 1. Authoritative DB Invoice Lookup
  const invoiceResult = await getInvoiceById(invoiceId);

  if (!invoiceResult.ok) {
    return NextResponse.json(
      {
        success: false,
        failureCode: invoiceResult.error.code,
        error: invoiceResult.error,
      },
      { status: invoiceResult.error.code === 'validation_error' ? 400 : 404 },
    );
  }

  const invoice = invoiceResult.data;

  // 2. AI Intent Extraction
  const aiResult = await extractPaymentIntent({
    emailBody: emailText,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
    dueDate: invoice.dueDate,
  });

  let extractedIntent: ExtractedIntent;

  if (aiResult.ok) {
    extractedIntent = aiResult.data;
  } else {
    // If AI fails or mock credentials in dev, log warning and use fallback extraction
    console.warn(
      `[Orchestration Warning] AI extraction failed (${aiResult.error.message}). Using fallback unknown intent.`,
    );
    extractedIntent = {
      intent: 'unknown',
      promisedAmountInr: null,
      promisedAmountPaise: null,
      promisedDate: null,
      disputePresent: false,
      confidence: 0,
      rationale: `AI extraction error: ${aiResult.error.message}`,
      evidence: emailText.slice(0, 100),
      resolvedFromPercentage: false,
    };
  }

  // 3. Deterministic Policy Evaluation (Passing DB Authoritative Amount)
  const policyDecision = evaluatePolicy({
    extraction: extractedIntent,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
  });

  let paymentLinkId: string | null = null;
  let paymentLinkUrl: string | null = null;
  let paymentError: string | null = null;

  // 4. Razorpay Test Payment Link Creation (If AUTO_RECOVER)
  if (policyDecision.decision === 'AUTO_RECOVER' && policyDecision.approvedAmountPaise) {
    const paymentLinkResult = await createTestPaymentLink({
      amountPaise: policyDecision.approvedAmountPaise,
      currency: 'INR',
      description: `RecoverAI Payment Link for Invoice #${invoice.invoiceNumber}`,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      invoiceId: invoice.id,
    });

    if (paymentLinkResult.ok) {
      paymentLinkId = paymentLinkResult.data.paymentLinkId;
      paymentLinkUrl = paymentLinkResult.data.shortUrl;
    } else {
      paymentError = paymentLinkResult.error.message;
      console.warn(
        `[Orchestration Warning] Razorpay payment link creation failed: ${paymentError}`,
      );
    }
  }

  // 5. Mandatory Audit Logging
  const auditMetadata = {
    original_email: emailText,
    extracted_fields: extractedIntent,
    policy_decision: policyDecision.decision,
    policy_reason: policyDecision.reason,
    guardrail_triggered: policyDecision.guardrailTriggered ?? null,
    approved_amount_paise: policyDecision.approvedAmountPaise,
    approved_amount_inr: policyDecision.approvedAmountInr,
    razorpay_link_id: paymentLinkId,
    short_url: paymentLinkUrl,
    payment_error: paymentError,
    timestamp: new Date().toISOString(),
  };

  const auditResult = await insertAuditLog({
    invoiceId: invoice.id,
    action: 'EMAIL_PROCESSED',
    actor: 'RECOVER_AI_ORCHESTRATOR',
    metadata: auditMetadata,
  });

  const auditLogId = auditResult.ok ? auditResult.data.id : null;

  // 6. Return Structured Response
  const responsePayload = {
    success: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
    outstandingAmountInr: invoice.outstandingAmountPaise / 100,
    intent: extractedIntent.intent,
    confidence: extractedIntent.confidence,
    rationale: extractedIntent.rationale,
    evidence: extractedIntent.evidence,
    decision: policyDecision.decision,
    reason: policyDecision.reason,
    guardrailTriggered: policyDecision.guardrailTriggered ?? null,
    approvedAmountPaise: policyDecision.approvedAmountPaise,
    approvedAmountInr: policyDecision.approvedAmountInr,
    paymentLinkUrl,
    paymentLinkId,
    paymentError,
    auditLogId,
  };

  return NextResponse.json(responsePayload, { status: 200 });
}
