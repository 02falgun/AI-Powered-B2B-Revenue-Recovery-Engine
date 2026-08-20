import crypto from 'crypto';
import type { Result } from './types';

export interface VerifyWebhookSignatureParams {
  readonly rawBody: string;
  readonly signature: string;
  readonly secret: string;
}

/**
 * Verifies Razorpay Webhook HMAC SHA256 Signature using timing-safe comparison.
 *
 * Security rules:
 * - Never log secret or raw signature.
 * - Perform timing-safe equality check to prevent timing attacks.
 * - Return explicit typed Result without throwing uncaught exceptions.
 */
export function verifyRazorpayWebhookSignature(
  params: VerifyWebhookSignatureParams,
): Result<{ readonly isValid: boolean }> {
  if (!params.secret || params.secret.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: 'Webhook secret is not configured.',
      },
    };
  }

  if (!params.signature || params.signature.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: 'Webhook signature header is missing.',
      },
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', params.secret)
      .update(params.rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(params.signature, 'utf8');

    if (
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return { ok: true, data: { isValid: true } };
    }

    return { ok: true, data: { isValid: false } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown HMAC computation error';
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: `Signature verification error: ${message}`,
      },
    };
  }
}
