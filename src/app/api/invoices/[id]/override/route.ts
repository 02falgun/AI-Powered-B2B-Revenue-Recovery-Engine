import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { overrideInvoiceStatus } from '@/lib/db';
import type { InvoiceStatus } from '@/lib/types';

export interface OverrideRequestBody {
  readonly newStatus?: InvoiceStatus;
  readonly reason?: string;
  readonly approvedPaise?: number;
}

/**
 * Admin Manual Override Route — Phase P1 Role-Based Access Control.
 *
 * Security:
 * - Requires active authenticated session.
 * - Enforces role === 'admin'. Operators receive HTTP 403 Forbidden.
 * - Records an immutable audit log entry (ADMIN_MANUAL_OVERRIDE).
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await props.params;

  if (!id || id.trim() === '') {
    return NextResponse.json(
      { success: false, error: { message: 'Invoice ID is required.' } },
      { status: 400 },
    );
  }

  // 1. Role Enforcement (Admin only)
  const authResult = await requireAdmin();

  if (!authResult.ok) {
    const isForbidden = authResult.error.message.includes('Administrator privileges');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isForbidden ? 'forbidden' : 'unauthorized',
          message: isForbidden
            ? 'Access denied: Only administrators can manually override Human Review cases.'
            : authResult.error.message,
        },
      },
      { status: isForbidden ? 403 : 401 },
    );
  }

  const adminUser = authResult.data;

  // 2. Parse and validate request body
  let body: OverrideRequestBody;
  try {
    body = (await request.json()) as OverrideRequestBody;
  } catch {
    body = {};
  }

  const newStatus: InvoiceStatus = body.newStatus || 'in_recovery';
  const reason =
    body.reason?.trim() || 'Manual administrative override approved from Human Review queue.';
  const approvedPaise = body.approvedPaise;

  // 3. Execute Override & Write Audit Log
  const overrideResult = await overrideInvoiceStatus({
    invoiceId: id,
    newStatus,
    adminActor: adminUser.email,
    reason,
    approvedPaise,
    requiredCompanyId: adminUser.companyId,
  });

  if (!overrideResult.ok) {
    const isUnauthorized = overrideResult.error.code === 'unauthorized_error';
    return NextResponse.json(
      { success: false, error: overrideResult.error },
      { status: isUnauthorized ? 403 : 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: `Invoice successfully updated to ${newStatus} by admin override.`,
      invoice: overrideResult.data,
    },
    { status: 200 },
  );
}
