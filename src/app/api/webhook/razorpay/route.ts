import { NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay-webhook';
import { updateInvoiceAfterPayment, insertAuditLog, isPaymentAlreadyProcessed } from '@/lib/db';

/**
 * Razorpay Webhook Endpoint — Phase 3 Implementation.
 *
 * Security & Reliability:
 * 1. Verifies HMAC SHA256 signature BEFORE parsing or touching DB.
 * 2. On payment_link.paid event, locates invoice via Razorpay link stored reference (notes.invoice_id).
 * 3. Performs basic idempotency check to avoid duplicate payment processing.
 * 4. Updates invoice outstanding amount and status (paid / partially_paid).
 * 5. Writes audit log to audit_logs table.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(
      '[Webhook Security Error] RAZORPAY_WEBHOOK_SECRET environment variable is missing or unconfigured.',
    );
    return NextResponse.json({ error: 'Webhook configuration error on server.' }, { status: 500 });
  }

  const signatureHeader = request.headers.get('x-razorpay-signature');

  if (!signatureHeader) {
    console.warn(
      '[Webhook Security Warning] Rejected request missing x-razorpay-signature header.',
    );
    return NextResponse.json({ error: 'Missing x-razorpay-signature header.' }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err: unknown) {
    console.error('[Webhook Read Error] Failed to parse raw request body:', err);
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 });
  }

  // 1. Strict HMAC SHA256 Signature Verification BEFORE database access
  const verificationResult = verifyRazorpayWebhookSignature({
    rawBody,
    signature: signatureHeader,
    secret: webhookSecret,
  });

  if (!verificationResult.ok || !verificationResult.data.isValid) {
    console.warn('[Webhook Security Warning] Razorpay webhook signature verification failed.');
    return NextResponse.json({ error: 'Invalid Razorpay webhook signature.' }, { status: 400 });
  }

  // 2. Parse Event Payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (err: unknown) {
    console.error('[Webhook Payload Error] Failed to parse event JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON event payload.' }, { status: 400 });
  }

  const eventName = String(payload.event ?? '');
  console.log(`[Webhook Security Audit] Verified Razorpay event: ${eventName}`);

  // Process payment_link.paid or payment.captured events
  if (eventName === 'payment_link.paid' || eventName === 'payment.captured') {
    try {
      const payloadObj = (payload.payload ?? {}) as Record<string, Record<string, unknown>>;
      const paymentLinkEntity = (payloadObj.payment_link?.entity ?? {}) as Record<string, unknown>;
      const paymentEntity = (payloadObj.payment?.entity ?? {}) as Record<string, unknown>;
      const notes = (paymentLinkEntity.notes ?? paymentEntity.notes ?? {}) as Record<
        string,
        unknown
      >;

      const invoiceId = String(notes.invoice_id ?? '');
      const paymentLinkId = String(paymentLinkEntity.id ?? paymentEntity.payment_link_id ?? '');
      const paymentId = String(
        paymentEntity.id ?? paymentLinkEntity.payment_id ?? `pay_mock_${Date.now()}`,
      );
      const amountPaidPaise = Number(paymentEntity.amount ?? paymentLinkEntity.amount ?? 0);

      if (!invoiceId) {
        console.warn(
          '[Webhook Processing Warning] Webhook payment event missing notes.invoice_id reference.',
        );
        return NextResponse.json(
          { received: true, status: 'ignored_missing_invoice_id' },
          { status: 200 },
        );
      }

      // 3. Idempotency Check
      const alreadyProcessed = await isPaymentAlreadyProcessed(paymentId);
      if (alreadyProcessed) {
        console.log(
          `[Webhook Idempotency] Payment ${paymentId} already processed. Skipping duplicate processing.`,
        );
        return NextResponse.json(
          { received: true, status: 'duplicate_ignored', paymentId },
          { status: 200 },
        );
      }

      // 4. Update Invoice Balance & Status in Supabase
      const updateResult = await updateInvoiceAfterPayment({
        invoiceId,
        amountPaidPaise,
        paymentId,
        paymentLinkId,
      });

      if (!updateResult.ok) {
        console.error(
          `[Webhook Processing Error] Failed to update invoice ${invoiceId}:`,
          updateResult.error,
        );
        return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      }

      const updatedInvoice = updateResult.data;

      // 5. Write Audit Log
      await insertAuditLog({
        invoiceId,
        action: 'PAYMENT_RECEIVED',
        actor: 'RAZORPAY_WEBHOOK',
        metadata: {
          payment_id: paymentId,
          payment_link_id: paymentLinkId,
          amount_paid_paise: amountPaidPaise,
          amount_paid_inr: amountPaidPaise / 100,
          new_outstanding_paise: updatedInvoice.outstandingAmountPaise,
          new_outstanding_inr: updatedInvoice.outstandingAmountPaise / 100,
          new_status: updatedInvoice.status,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(
        `[Webhook Success] Invoice ${invoiceId} updated to status=${updatedInvoice.status}, remaining=${updatedInvoice.outstandingAmountPaise} paise.`,
      );

      return NextResponse.json(
        {
          received: true,
          status: 'payment_processed',
          invoiceId,
          newStatus: updatedInvoice.status,
          remainingOutstandingPaise: updatedInvoice.outstandingAmountPaise,
        },
        { status: 200 },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown webhook execution error';
      console.error('[Webhook Exception Error]:', err);
      return NextResponse.json({ error: `Webhook handling error: ${message}` }, { status: 500 });
    }
  }

  return NextResponse.json(
    { received: true, status: 'event_acknowledged_no_action' },
    { status: 200 },
  );
}
