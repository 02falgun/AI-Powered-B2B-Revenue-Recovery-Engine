import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { purgeCompanyData } from '@/lib/db';
import { checkAdminPurgeRateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

export interface PurgeCompanyRequestBody {
  readonly company_id?: string;
  readonly confirm?: boolean;
}

/**
 * Phase P8 — Admin Data Purge Endpoint
 *
 * Security:
 * - Requires active session with role === 'admin' (requireAdmin()).
 * - Rate-limited to prevent abuse (5 purge requests per hour per admin).
 * - Multi-tenant scoping: validates admin's company_id match.
 * - Explicit confirmation required: body.confirm === true.
 * - Additive data handling: deletes data rows matching company_id, does not alter schema.
 */
export async function POST(request: Request): Promise<NextResponse> {
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
            ? 'Access denied: Only administrators can execute company data purges.'
            : authResult.error.message,
        },
      },
      { status: isForbidden ? 403 : 401 },
    );
  }

  const adminUser = authResult.data;

  // 2. Rate-Limit Enforcement
  const rateLimitRes = await checkAdminPurgeRateLimit(adminUser.id);
  if (!rateLimitRes.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'rate_limited',
          message: `Admin data purge rate limit exceeded. Please retry in ${rateLimitRes.retryAfterSeconds}s.`,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitRes.retryAfterSeconds),
          'X-RateLimit-Limit': String(rateLimitRes.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitRes.reset),
        },
      },
    );
  }

  // 3. Request Body Validation
  let body: PurgeCompanyRequestBody;
  try {
    body = (await request.json()) as PurgeCompanyRequestBody;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON body';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'validation_error',
          message: `Malformed request JSON: ${message}`,
        },
      },
      { status: 400 },
    );
  }

  const targetCompanyId = body.company_id?.trim();
  if (!targetCompanyId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'validation_error',
          message: 'company_id is a required parameter for data purge.',
        },
      },
      { status: 400 },
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Explicit confirmation required: "confirm" must be true to proceed with purge.',
        },
      },
      { status: 400 },
    );
  }

  // 4. Multi-Tenant Scoping Enforcement (P5)
  // Ensure the admin can only purge their own company unless designated as platform admin
  if (adminUser.companyId && adminUser.companyId !== targetCompanyId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'unauthorized_error',
          message: `Access denied: You cannot purge data for company ${targetCompanyId}. You belong to company ${adminUser.companyId}.`,
        },
      },
      { status: 403 },
    );
  }

  // 5. Log purge attempt
  logger.info('Admin company data purge initiated', {
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    targetCompanyId,
  });

  // 6. Execute Purge
  const purgeRes = await purgeCompanyData(targetCompanyId);
  if (!purgeRes.ok) {
    return NextResponse.json(
      {
        success: false,
        error: purgeRes.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: `Successfully purged data for company ${targetCompanyId}.`,
      purged: {
        invoices: purgeRes.data.invoicesDeleted,
        email_jobs: purgeRes.data.emailJobsDeleted,
        audit_logs: purgeRes.data.auditLogsDeleted,
      },
      company_id: purgeRes.data.companyId,
      purged_at: purgeRes.data.purgedAt,
    },
    { status: 200 },
  );
}
