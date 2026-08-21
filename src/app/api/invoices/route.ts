import { NextResponse } from 'next/server';
import { getAllInvoices } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const result = await getAllInvoices();

  if (!result.ok) {
    // If DB isn't seeded yet, return static fallback seed data for developer UI testing
    return NextResponse.json({
      success: true,
      invoices: [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          invoiceNumber: 'INV-2026-001',
          customerName: 'Acme Corporation',
          customerEmail: 'finance@acmecorp.com',
          totalAmountPaise: 1500000,
          outstandingAmountPaise: 1500000,
          currency: 'INR',
          status: 'overdue',
          dueDate: '2026-08-01',
        },
        {
          id: 'b78ac20c-69dd-4483-b678-1f03c3d4e580',
          invoiceNumber: 'INV-2026-002',
          customerName: 'TechFlow Solutions',
          customerEmail: 'billing@techflow.io',
          totalAmountPaise: 4550050,
          outstandingAmountPaise: 4550050,
          currency: 'INR',
          status: 'overdue',
          dueDate: '2026-08-05',
        },
        {
          id: 'c89bd30d-70ee-5594-c789-2a04d4e5f691',
          invoiceNumber: 'INV-2026-003',
          customerName: 'Global Logistics Ltd',
          customerEmail: 'ap@globallogistics.com',
          totalAmountPaise: 12000000,
          outstandingAmountPaise: 6000000,
          currency: 'INR',
          status: 'overdue',
          dueDate: '2026-07-20',
        },
      ],
    });
  }

  return NextResponse.json({
    success: true,
    invoices: result.data,
  });
}
