import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Result, AppError, Invoice } from './types';

/**
 * Server-side trusted database helper.
 * Uses SUPABASE_SERVICE_ROLE_KEY for administrative operations (bypassing RLS for system actions).
 * Fails closed if Supabase configuration is missing or invalid.
 */
function getSupabaseAdminClient(): Result<SupabaseClient, AppError> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      error: {
        code: 'db_error',
        message:
          'Supabase configuration missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.',
      },
    };
  }

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return { ok: true, data: client };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to instantiate Supabase admin client';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Supabase initialization error: ${message}`,
      },
    };
  }
}

/**
 * Maps raw database invoice row to domain Invoice interface.
 */
function mapRawToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    totalAmountPaise: Number(row.total_amount_paise),
    outstandingAmountPaise: Number(row.outstanding_amount_paise),
    currency: 'INR',
    status: row.status as Invoice['status'],
    dueDate: String(row.due_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Fetches an invoice by UUID from Supabase.
 */
export async function getInvoiceById(invoiceId: string): Promise<Result<Invoice, AppError>> {
  if (!invoiceId || invoiceId.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'validation_error',
        message: 'invoiceId is required.',
      },
    };
  }

  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const supabase = clientResult.data;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error) {
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Database query failed for invoice ${invoiceId}: ${error.message}`,
          details: { error },
        },
      };
    }

    if (!data) {
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Invoice with ID ${invoiceId} was not found.`,
        },
      };
    }

    return { ok: true, data: mapRawToInvoice(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Failed to fetch invoice: ${message}`,
      },
    };
  }
}

/**
 * Fetches all invoices from Supabase.
 */
export async function getAllInvoices(): Promise<Result<ReadonlyArray<Invoice>, AppError>> {
  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const supabase = clientResult.data;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Failed to fetch invoices list: ${error.message}`,
        },
      };
    }

    const invoices = (data ?? []).map(mapRawToInvoice);
    return { ok: true, data: invoices };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Failed to query invoices: ${message}`,
      },
    };
  }
}

export interface InsertAuditLogParams {
  readonly invoiceId: string;
  readonly action: string;
  readonly actor: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Inserts a record into the audit_logs table.
 * Always succeeds or returns explicit Result error.
 */
export async function insertAuditLog(
  params: InsertAuditLogParams,
): Promise<Result<{ readonly id: string }, AppError>> {
  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const supabase = clientResult.data;

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        invoice_id: params.invoiceId,
        action: params.action,
        actor: params.actor,
        metadata: params.metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error(
        `[DB Audit Log Error] Failed to write audit log for invoice ${params.invoiceId}:`,
        error,
      );
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Failed to insert audit log: ${error.message}`,
        },
      };
    }

    return { ok: true, data: { id: String(data.id) } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown audit log DB error';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Audit log error: ${message}`,
      },
    };
  }
}

export interface UpdateInvoicePaymentParams {
  readonly invoiceId: string;
  readonly amountPaidPaise: number;
  readonly paymentId: string;
  readonly paymentLinkId?: string;
}

/**
 * Updates invoice outstanding amount and status after payment completed via Razorpay webhook.
 */
export async function updateInvoiceAfterPayment(
  params: UpdateInvoicePaymentParams,
): Promise<Result<Invoice, AppError>> {
  const invoiceResult = await getInvoiceById(params.invoiceId);
  if (!invoiceResult.ok) {
    return invoiceResult;
  }

  const invoice = invoiceResult.data;
  const newOutstandingPaise = Math.max(0, invoice.outstandingAmountPaise - params.amountPaidPaise);
  const newStatus = newOutstandingPaise === 0 ? 'paid' : 'partially_paid';

  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const supabase = clientResult.data;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        outstanding_amount_paise: newOutstandingPaise,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.invoiceId)
      .select('*')
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Failed to update invoice payment status: ${error?.message ?? 'No data returned'}`,
        },
      };
    }

    return { ok: true, data: mapRawToInvoice(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown invoice payment update error';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Failed to update invoice payment: ${message}`,
      },
    };
  }
}

/**
 * Basic Idempotency Check: Checks if a Razorpay payment_id has already been processed in audit_logs.
 */
export async function isPaymentAlreadyProcessed(paymentId: string): Promise<boolean> {
  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return false;
  }

  const supabase = clientResult.data;

  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('action', 'PAYMENT_RECEIVED')
      .filter('metadata->>paymentId', 'eq', paymentId)
      .limit(1);

    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fetches audit logs timeline for a specific invoice.
 */
export async function getAuditLogsForInvoice(
  invoiceId: string,
): Promise<Result<ReadonlyArray<Record<string, unknown>>, AppError>> {
  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return clientResult;
  }

  const supabase = clientResult.data;

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        ok: false,
        error: {
          code: 'db_error',
          message: `Failed to fetch audit logs: ${error.message}`,
        },
      };
    }

    return { ok: true, data: data ?? [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown audit query error';
    return {
      ok: false,
      error: {
        code: 'db_error',
        message: `Failed to fetch audit logs: ${message}`,
      },
    };
  }
}
