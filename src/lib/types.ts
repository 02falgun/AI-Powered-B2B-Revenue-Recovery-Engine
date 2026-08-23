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
  | 'unauthorized_error'
  | 'rate_limited';

export interface AppError {
  readonly code: FailureCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type Result<T, E = AppError> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: E };

export type InvoiceStatus = 'overdue' | 'paid' | 'partially_paid' | 'in_recovery' | 'human_review';

export interface Company {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface Invoice {
  readonly id: string;
  readonly companyId?: string;
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
  readonly companyId?: string;
  readonly action: string;
  readonly actor: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export type UserRole = 'admin' | 'operator';

export interface UserProfile {
  readonly id: string;
  readonly role: UserRole;
  readonly companyId?: string;
  readonly email?: string;
  readonly createdAt: string;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly companyId?: string;
}

export type EmailJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unmatched';

export interface IngestedEmailJob {
  readonly id: string;
  readonly messageId: string;
  readonly sender: string;
  readonly subject: string;
  readonly body: string;
  readonly invoiceId: string | null;
  readonly companyId?: string;
  readonly status: EmailJobStatus;
  readonly errorMessage: string | null;
  readonly attempts: number;
  readonly processedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginationParams {
  readonly page?: number;
  readonly limit?: number;
  readonly status?: InvoiceStatus;
  readonly companyId?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}
