import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export interface CreateOrderRequestBody {
  readonly amountPaise?: number;
  readonly currency?: string;
  readonly receipt?: string;
  readonly invoiceId?: string;
}

/**
 * Backend API Route — Razorpay Standard Checkout Order Creation
 *
 * STEP 1: Create Order
 * - Endpoint: POST /api/create-order
 * - Minimum amount: 100 paise (1 INR)
 * - Returns: { success: true, order_id, amount, currency, key_id }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error(
      '[Razorpay Order Error] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.',
    );
    return NextResponse.json(
      { success: false, error: 'Razorpay API credentials unconfigured on server.' },
      { status: 500 },
    );
  }

  let body: CreateOrderRequestBody;
  try {
    body = (await request.json()) as CreateOrderRequestBody;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return NextResponse.json(
      { success: false, error: `Malformed JSON request body: ${message}` },
      { status: 400 },
    );
  }

  const amountPaise = Number(body.amountPaise);

  // Validate minimum amount requirement (>= 100 paise / 1 INR)
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    return NextResponse.json(
      { success: false, error: 'Minimum order amount must be at least 100 paise (₹1.00).' },
      { status: 400 },
    );
  }

  try {
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptId = body.receipt || `rcpt_${Date.now()}`;
    const currency = body.currency || 'INR';

    const orderOptions = {
      amount: amountPaise,
      currency,
      receipt: receiptId,
      notes: {
        invoice_id: body.invoiceId || '',
        source: 'recover_ai_checkout',
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    if (!order || !order.id) {
      return NextResponse.json(
        { success: false, error: 'Razorpay returned empty order response.' },
        { status: 500 },
      );
    }

    const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId;

    return NextResponse.json(
      {
        success: true,
        order_id: order.id,
        amount: Number(order.amount),
        currency: String(order.currency),
        key_id: publicKeyId,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Razorpay order error';
    const isAuthError =
      message.toLowerCase().includes('auth') || message.toLowerCase().includes('credential');

    console.error('[Razorpay Order Creation Error]:', err);

    return NextResponse.json(
      { success: false, error: `Razorpay order creation failed: ${message}` },
      { status: isAuthError ? 401 : 500 },
    );
  }
}
