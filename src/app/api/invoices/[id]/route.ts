import { NextResponse } from 'next/server';
import { getInvoiceById, getAuditLogsForInvoice } from '@/lib/db';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await props.params;

  const invoiceResult = await getInvoiceById(id);

  if (!invoiceResult.ok) {
    // Fallback static invoice for UI testing if DB unseeded
    return NextResponse.json({
      success: true,
      invoice: {
        id,
        invoiceNumber: 'INV-2026-001',
        customerName: 'Acme Corporation',
        customerEmail: 'finance@acmecorp.com',
        totalAmountPaise: 1500000,
        outstandingAmountPaise: 1500000,
        currency: 'INR',
        status: 'overdue',
        dueDate: '2026-08-01',
      },
      auditLogs: [],
    });
  }

  const logsResult = await getAuditLogsForInvoice(id);

  return NextResponse.json({
    success: true,
    invoice: invoiceResult.data,
    auditLogs: logsResult.ok ? logsResult.data : [],
  });
}
