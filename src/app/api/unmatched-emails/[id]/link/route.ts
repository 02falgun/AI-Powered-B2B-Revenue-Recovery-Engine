import { NextResponse } from 'next/server';
import { linkUnmatchedEmailToInvoice } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Links an unmatched email job to an invoice, moving it to 'pending' queue.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authRes = await requireAuth();
  if (!authRes.ok) {
    return NextResponse.json(
      { success: false, error: authRes.error },
      { status: 401 },
    );
  }

  const { id: jobId } = await props.params;

  let body: { invoice_id?: string };
  try {
    body = (await request.json()) as { invoice_id?: string };
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'validation_error', message: 'Invalid JSON request payload.' },
      },
      { status: 400 },
    );
  }

  const invoiceId = body.invoice_id?.trim();
  if (!invoiceId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'validation_error', message: 'Missing required invoice_id.' },
      },
      { status: 400 },
    );
  }

  const linkRes = await linkUnmatchedEmailToInvoice(jobId, invoiceId);
  if (!linkRes.ok) {
    return NextResponse.json(
      { success: false, error: linkRes.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    data: linkRes.data,
    message: `Email successfully linked to invoice ${invoiceId} and queued for processing.`,
  });
}
