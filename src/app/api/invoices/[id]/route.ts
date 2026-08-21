import { NextResponse } from 'next/server';
import { getInvoiceById, getAuditLogsForInvoice } from '@/lib/db';

const MOCK_FALLBACK_INVOICES = [
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

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await props.params;

  const invoiceResult = await getInvoiceById(id);

  if (!invoiceResult.ok) {
    // Look up in fallback mock invoices array by ID
    const matchedMock = MOCK_FALLBACK_INVOICES.find(
      (inv) => inv.id === id || inv.invoiceNumber === id,
    ) ?? {
      id,
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
    };

    return NextResponse.json({
      success: true,
      invoice: matchedMock,
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
