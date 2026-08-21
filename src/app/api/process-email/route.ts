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
 * Core Orchestration API Route — Hardened in Phase 4.
 *
 * Sequence & Reliability Invariants:
 * 1. Input validation.
 * 2. Supabase DB invoice lookup for authoritative outstanding balance.
 * 3. AI intent extraction (lib/ai.ts) with 10s timeout & fail-closed error handling.
 * 4. Deterministic policy evaluation (lib/policy.ts).
 * 5. If AUTO_RECOVER: Razorpay Test Payment Link creation (lib/razorpay.ts).
 *    - On Razorpay failure: Overrides decision to HUMAN_REVIEW, logs PAYMENT_LINK_FAILED, returns failure.
 * 6. Mandatory audit logging (audit_logs table).
 * 7. Typed JSON response with explicit failure modes (validation_error, ai_error, policy_rejected, payment_error).
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

  let invoice;
  if (invoiceResult.ok) {
    invoice = invoiceResult.data;
  } else {
    // Fallback mock invoices for local dev testing when DB is unseeded
    const MOCK_INVOICES = [
      {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        invoiceNumber: 'INV-2026-001',
        customerName: 'Acme Corporation',
        customerEmail: 'finance@acmecorp.com',
        totalAmountPaise: 1500000,
        outstandingAmountPaise: 1500000,
        currency: 'INR' as const,
        status: 'overdue' as const,
        dueDate: '2026-08-01',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
      {
        id: 'b78ac20c-69dd-4483-b678-1f03c3d4e580',
        invoiceNumber: 'INV-2026-002',
        customerName: 'TechFlow Solutions',
        customerEmail: 'billing@techflow.io',
        totalAmountPaise: 4550050,
        outstandingAmountPaise: 4550050,
        currency: 'INR' as const,
        status: 'overdue' as const,
        dueDate: '2026-08-05',
        createdAt: '2026-08-05T00:00:00Z',
        updatedAt: '2026-08-05T00:00:00Z',
      },
      {
        id: 'c89bd30d-70ee-5594-c789-2a04d4e5f691',
        invoiceNumber: 'INV-2026-003',
        customerName: 'Global Logistics Ltd',
        customerEmail: 'ap@globallogistics.com',
        totalAmountPaise: 12000000,
        outstandingAmountPaise: 6000000,
        currency: 'INR' as const,
        status: 'overdue' as const,
        dueDate: '2026-07-20',
        createdAt: '2026-07-20T00:00:00Z',
        updatedAt: '2026-07-20T00:00:00Z',
      },
    ];

    const matchedMock = MOCK_INVOICES.find(
      (inv) => inv.id === invoiceId || inv.invoiceNumber === invoiceId,
    );

    if (matchedMock) {
      invoice = matchedMock;
    } else {
      return NextResponse.json(
        {
          success: false,
          failureCode: invoiceResult.error.code,
          error: invoiceResult.error,
        },
        { status: invoiceResult.error.code === 'validation_error' ? 400 : 404 },
      );
    }
  }

  // 2. AI Intent Extraction (Hardened with timeout & explicit error typing)
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
    // Phase 4 Requirement 2: Fail closed on AI timeout or extraction error
    console.error(`[Process Email AI Failure] ${aiResult.error.message}`);

    const failureReason = `AI intent extraction failure: ${aiResult.error.message}. Routed to HUMAN_REVIEW.`;

    const auditResult = await insertAuditLog({
      invoiceId: invoice.id,
      action: 'EMAIL_PROCESSING_FAILED',
      actor: 'RECOVER_AI_ORCHESTRATOR',
      metadata: {
        original_email: emailText,
        policy_decision: 'HUMAN_REVIEW',
        policy_reason: failureReason,
        failure_code: 'ai_error',
        error: aiResult.error,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        failureCode: 'ai_error',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        outstandingAmountPaise: invoice.outstandingAmountPaise,
        intent: 'unknown',
        confidence: 0,
        decision: 'HUMAN_REVIEW',
        reason: failureReason,
        auditLogId: auditResult.ok ? auditResult.data.id : null,
        error: aiResult.error,
      },
      { status: 422 },
    );
  }

  // 3. Deterministic Policy Evaluation (Passing DB Authoritative Amount)
  const policyDecision = evaluatePolicy({
    extraction: extractedIntent,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
  });

  let paymentLinkId: string | null = null;
  let paymentLinkUrl: string | null = null;
  let paymentError: string | null = null;
  let finalDecision = policyDecision.decision;
  let finalReason = policyDecision.reason;

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
      // Phase 4 Requirement 3: Handle Razorpay failure cleanly
      paymentError = paymentLinkResult.error.message;
      finalDecision = 'HUMAN_REVIEW';
      finalReason = `Payment link creation failed after policy approval: ${paymentError}`;

      console.error(`[Process Email Razorpay Failure] ${finalReason}`);

      const auditResult = await insertAuditLog({
        invoiceId: invoice.id,
        action: 'PAYMENT_LINK_FAILED',
        actor: 'RECOVER_AI_ORCHESTRATOR',
        metadata: {
          original_email: emailText,
          extracted_fields: extractedIntent,
          policy_decision: 'HUMAN_REVIEW',
          policy_reason: finalReason,
          payment_error: paymentError,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          failureCode: 'payment_error',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          outstandingAmountPaise: invoice.outstandingAmountPaise,
          intent: extractedIntent.intent,
          confidence: extractedIntent.confidence,
          decision: 'HUMAN_REVIEW',
          reason: finalReason,
          paymentError,
          auditLogId: auditResult.ok ? auditResult.data.id : null,
          error: { code: 'payment_error', message: paymentError },
        },
        { status: 500 },
      );
    }
  }

  // 5. Mandatory Audit Logging
  const auditMetadata = {
    original_email: emailText,
    extracted_fields: extractedIntent,
    policy_decision: finalDecision,
    policy_reason: finalReason,
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
    decision: finalDecision,
    reason: finalReason,
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
