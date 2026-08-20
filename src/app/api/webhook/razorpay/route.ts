import { NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay-webhook';

/**
 * Razorpay Webhook Endpoint — Phase 0 Implementation.
 *
 * SCOPE: Signature verification ONLY. No database updates or business logic.
 *
 * Returns 400 Bad Request if signature is missing, malformed, or invalid.
 * Returns 200 OK if signature matches secret.
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

  const verificationResult = verifyRazorpayWebhookSignature({
    rawBody,
    signature: signatureHeader,
    secret: webhookSecret,
  });

  if (!verificationResult.ok) {
    console.warn(
      `[Webhook Security Warning] Signature verification failed: ${verificationResult.error.message}`,
    );
    return NextResponse.json({ error: 'Invalid or malformed signature payload.' }, { status: 400 });
  }

  if (!verificationResult.data.isValid) {
    console.warn('[Webhook Security Warning] Razorpay webhook signature verification mismatch.');
    return NextResponse.json({ error: 'Invalid Razorpay webhook signature.' }, { status: 400 });
  }

  // Verification succeeded! (Phase 0: No DB touch or business logic yet)
  console.log('[Webhook Security Audit] Razorpay webhook signature successfully verified.');

  return NextResponse.json({ received: true, status: 'signature_verified' }, { status: 200 });
}
