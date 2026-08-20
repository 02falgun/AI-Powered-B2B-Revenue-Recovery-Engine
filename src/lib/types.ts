/**
 * Domain entity and system result type definitions for RecoverAI.
 * Money amounts are strictly represented in integer paise (1 INR = 100 paise).
 */

export type FailureCode =
  | 'validation_error'
  | 'ai_error'
  | 'policy_rejected'
  | 'payment_error'
  | 'db_error'
  | 'unauthorized_error';

export interface AppError {
  readonly code: FailureCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type Result<T, E = AppError> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: E };

export type InvoiceStatus = 'overdue' | 'paid' | 'partially_paid' | 'in_recovery' | 'human_review';

export interface Invoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly totalAmountPaise: number;
  readonly outstandingAmountPaise: number;
  readonly currency: 'INR';
  readonly status: InvoiceStatus;
  readonly dueDate: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditLog {
  readonly id: string;
  readonly invoiceId: string;
  readonly action: string;
  readonly actor: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}
