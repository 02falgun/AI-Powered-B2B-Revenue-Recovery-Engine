import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { updateInvoiceAfterPayment, insertAuditLog } from '@/lib/db';

export interface VerifyPaymentRequestBody {
  readonly razorpay_order_id?: string;
  readonly razorpay_payment_id?: string;
  readonly razorpay_signature?: string;
  readonly invoice_id?: string;
  readonly amount_paid_paise?: number;
}

/**
 * Backend API Route — Razorpay Standard Checkout Signature Verification
 *
 * STEP 3: BACKEND - Verify Signature
 * - Endpoint: POST /api/verify-payment
 * - Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * - Uses timing-safe equality comparison
 * - On match: Updates invoice & logs audit event
 * - On mismatch: Returns HTTP 400, does NOT mark as paid
 */
export async function POST(request: Request): Promise<NextResponse> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.error('[Razorpay Verify Error] RAZORPAY_KEY_SECRET missing in environment.');
    return NextResponse.json(
      { success: false, error: 'Server payment configuration missing.' },
      { status: 500 },
    );
  }

  let body: VerifyPaymentRequestBody;
  try {
    body = (await request.json()) as VerifyPaymentRequestBody;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return NextResponse.json(
      { success: false, error: `Malformed JSON request body: ${message}` },
      { status: 400 },
    );
  }

  const orderId = body.razorpay_order_id?.trim();
  const paymentId = body.razorpay_payment_id?.trim();
  const signature = body.razorpay_signature?.trim();

  // Validate missing fields
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Missing required verification parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required.',
      },
      { status: 400 },
    );
  }

  try {
    // HMAC-SHA256 algorithm: order_id + "|" + payment_id
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    // Timing-safe comparison to prevent timing attacks
    const isSignatureValid =
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isSignatureValid) {
      console.warn(
        `[Razorpay Security Alert] Signature mismatch for order_id: ${orderId}, payment_id: ${paymentId}`,
      );
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature. Verification failed.' },
        { status: 400 },
      );
    }

    console.log(`[Razorpay Success] Payment signature verified for payment_id: ${paymentId}`);

    const invoiceId = body.invoice_id?.trim();
    let updatedInvoice = null;

    // If invoice_id is present, update invoice in Supabase DB
    if (invoiceId) {
      const amountPaidPaise = body.amount_paid_paise ?? 0;
      const updateResult = await updateInvoiceAfterPayment({
        invoiceId,
        amountPaidPaise,
        paymentId,
      });

      if (updateResult.ok) {
        updatedInvoice = updateResult.data;
      }

      // Write audit log
      await insertAuditLog({
        invoiceId,
        action: 'PAYMENT_VERIFIED',
        actor: 'RAZORPAY_CHECKOUT_VERIFIER',
        metadata: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          verified: true,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        payment_id: paymentId,
        order_id: orderId,
        invoice: updatedInvoice,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown verification exception';
    console.error('[Razorpay Signature Verification Exception]:', err);
    return NextResponse.json(
      { success: false, error: `Signature verification exception: ${message}` },
      { status: 500 },
    );
  }
}
