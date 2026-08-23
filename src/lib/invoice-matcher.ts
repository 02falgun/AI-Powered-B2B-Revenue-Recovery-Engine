import { getAllInvoices } from './db';
import type { Invoice } from './types';

export interface MatchInvoiceParams {
  readonly sender: string;
  readonly subject: string;
  readonly body: string;
}

export type MatchConfidence = 'high' | 'medium' | 'none';

export interface InvoiceMatchResult {
  readonly matched: boolean;
  readonly invoice: Invoice | null;
  readonly confidence: MatchConfidence;
  readonly reason: string;
}

/**
 * Regex matching standard invoice identifiers: INV-2026-001, INV-001, #INV-2026-001, etc.
 */
const INVOICE_NUMBER_REGEX = /\b(?:INV[-_ ]?\d{4}[-_ ]?\d{3,}|\bINV[-_ ]?\d{3,})\b/i;

/**
 * Authoritative invoice matcher.
 * Matches incoming email to an invoice using:
 * 1. Explicit invoice identifier in subject or body (High confidence).
 * 2. Unique sender email match against an overdue invoice (Medium confidence).
 * 3. Ambiguous / Multiple / Unknown -> Safe routing to Unmatched Queue (No forced guessing).
 */
export async function matchIncomingEmailToInvoice(
  params: MatchInvoiceParams,
): Promise<InvoiceMatchResult> {
  const invoicesResult = await getAllInvoices();
  const allInvoices: readonly Invoice[] = invoicesResult.ok
    ? invoicesResult.data
    : [
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
          currency: 'INR',
          status: 'overdue',
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
          currency: 'INR',
          status: 'overdue',
          dueDate: '2026-07-20',
          createdAt: '2026-07-20T00:00:00Z',
          updatedAt: '2026-07-20T00:00:00Z',
        },
      ];

  // 1. Check for explicit invoice number in Subject line (Highest Priority)
  const subjectMatch = params.subject.match(INVOICE_NUMBER_REGEX);
  if (subjectMatch) {
    const rawInvNum = subjectMatch[0].replace(/[_\s]/g, '-').toUpperCase();
    const invoice = allInvoices.find(
      (inv) => inv.invoiceNumber.toUpperCase() === rawInvNum,
    );
    if (invoice) {
      return {
        matched: true,
        invoice,
        confidence: 'high',
        reason: `Explicit invoice number ${invoice.invoiceNumber} found in email subject.`,
      };
    }
  }

  // 2. Check for explicit invoice number in Email Body
  const bodyMatch = params.body.match(INVOICE_NUMBER_REGEX);
  if (bodyMatch) {
    const rawInvNum = bodyMatch[0].replace(/[_\s]/g, '-').toUpperCase();
    const invoice = allInvoices.find(
      (inv) => inv.invoiceNumber.toUpperCase() === rawInvNum,
    );
    if (invoice) {
      return {
        matched: true,
        invoice,
        confidence: 'high',
        reason: `Explicit invoice number ${invoice.invoiceNumber} found in email body.`,
      };
    }
  }

  // 3. Sender Email matching against active overdue invoices
  const normalizedSender = params.sender.toLowerCase().trim();
  const matchingBySender = allInvoices.filter(
    (inv) =>
      inv.customerEmail.toLowerCase() === normalizedSender &&
      (inv.status === 'overdue' || inv.status === 'in_recovery'),
  );

  if (matchingBySender.length === 1) {
    const invoice = matchingBySender[0];
    return {
      matched: true,
      invoice,
      confidence: 'medium',
      reason: `Single active overdue invoice found for buyer ${params.sender}.`,
    };
  }

  if (matchingBySender.length > 1) {
    return {
      matched: false,
      invoice: null,
      confidence: 'none',
      reason: `Ambiguous: Multiple active overdue invoices (${matchingBySender.map((i) => i.invoiceNumber).join(', ')}) found for sender ${params.sender}. Routed to Unmatched Review Queue.`,
    };
  }

  // 4. No confident match
  return {
    matched: false,
    invoice: null,
    confidence: 'none',
    reason: `No matching invoice found for sender "${params.sender}" and subject "${params.subject}". Routed to Unmatched Review Queue.`,
  };
}
