import { NextRequest, NextResponse } from 'next/server';
import { getPaginatedInvoices } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { InvoiceStatus } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const statusParam = searchParams.get('status') as InvoiceStatus | null;

  // Resolve user session for multi-tenant isolation
  const userResult = await getCurrentUser();
  const companyId = userResult.ok ? userResult.data.companyId : searchParams.get('companyId') || undefined;

  const result = await getPaginatedInvoices({
    page,
    limit,
    status: statusParam || undefined,
    companyId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    invoices: result.data.items,
    pagination: {
      total: result.data.total,
      page: result.data.page,
      limit: result.data.limit,
      totalPages: result.data.totalPages,
    },
  });
}
