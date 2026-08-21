import { NextResponse } from 'next/server';
import { getAuditLogsForInvoice } from '@/lib/db';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await props.params;

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Invoice ID is required' },
      },
      { status: 400 },
    );
  }

  const result = await getAuditLogsForInvoice(id);

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Unable to retrieve audit history for this invoice at this time.' },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    auditLogs: result.data,
  });
}
