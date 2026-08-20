import Razorpay from 'razorpay';
import type { Result, AppError } from './types';

export interface CreatePaymentLinkParams {
  readonly amountPaise: number;
  readonly currency?: 'INR';
  readonly description: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone?: string;
  readonly invoiceId: string;
  readonly expireByTimestamp?: number;
}

export interface CreatePaymentLinkResult {
  readonly paymentLinkId: string;
  readonly shortUrl: string;
  readonly status: string;
  readonly amountPaise: number;
  readonly currency: string;
}

/**
 * Encapsulated Razorpay client factory.
 * Fails closed if environment credentials are missing.
 */
function getRazorpayClient(): Result<Razorpay, AppError> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return {
      ok: false,
      error: {
        code: 'payment_error',
        message:
          'Razorpay configuration missing: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in environment.',
      },
    };
  }

  try {
    const client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    return { ok: true, data: client };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to instantiate Razorpay client';
    return {
      ok: false,
      error: {
        code: 'payment_error',
        message: `Razorpay client initialization error: ${message}`,
      },
    };
  }
}

/**
 * Creates a Razorpay Test Mode Payment Link.
 *
 * Money correctness rules:
 * - All amounts MUST be integers in paise (1 INR = 100 paise).
 * - Fails closed on missing credentials, network errors, or Razorpay API errors.
 */
export async function createTestPaymentLink(
  params: CreatePaymentLinkParams,
): Promise<Result<CreatePaymentLinkResult>> {
  // Input validation for money correctness
  if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: `Invalid amountPaise: must be a positive integer in paise. Received: ${params.amountPaise}`,
      },
    };
  }

  if (!params.customerEmail || !params.customerEmail.includes('@')) {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: `Invalid customerEmail: must be a valid email address. Received: ${params.customerEmail}`,
      },
    };
  }

  const clientResult = getRazorpayClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const razorpay = clientResult.data;

  try {
    const payload = {
      amount: params.amountPaise,
      currency: params.currency ?? 'INR',
      accept_partial: false,
      description: params.description,
      customer: {
        name: params.customerName,
        email: params.customerEmail,
        contact: params.customerPhone ?? '+919999999999',
      },
      notify: {
        sms: false,
        email: true,
      },
      reminder_enable: false,
      notes: {
        invoice_id: params.invoiceId,
        source: 'recover_ai',
      },
      ...(params.expireByTimestamp ? { expire_by: params.expireByTimestamp } : {}),
    };

    const response = await razorpay.paymentLink.create(payload);

    if (!response || !response.id || !response.short_url) {
      return {
        ok: false,
        error: {
          code: 'payment_error',
          message: 'Razorpay API returned an empty or malformed payment link response.',
          details: { rawResponse: response },
        },
      };
    }

    return {
      ok: true,
      data: {
        paymentLinkId: response.id,
        shortUrl: response.short_url,
        status: response.status ?? 'created',
        amountPaise: Number(response.amount),
        currency: String(response.currency),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Razorpay payment link error';
    return {
      ok: false,
      error: {
        code: 'payment_error',
        message: `Failed to create Razorpay payment link: ${message}`,
        details: err instanceof Error ? { name: err.name, stack: err.stack } : { err },
      },
    };
  }
}
