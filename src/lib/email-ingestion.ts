import { matchIncomingEmailToInvoice } from './invoice-matcher';
import { enqueueEmailJob } from './db';
import type { IngestedEmailJob } from './types';

export interface RawEmailMessage {
  readonly messageId: string;
  readonly sender: string;
  readonly subject: string;
  readonly body: string;
  readonly receivedAt?: string;
}

export interface IngestionRunResult {
  readonly success: boolean;
  readonly totalIngested: number;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
  readonly jobs: IngestedEmailJob[];
  readonly details: string;
}

// Built-in sample email feed for test runs and demo mode
const DEMO_INBOX_FEED: RawEmailMessage[] = [
  {
    messageId: 'msg_imap_demo_001',
    sender: 'finance@acmecorp.com',
    subject: 'Re: Overdue Invoice INV-2026-001 - Payment Schedule',
    body: 'Hi RecoverAI Team,\n\nWe have reviewed invoice INV-2026-001 and will initiate the full payment of Rs 15,000 tomorrow (2026-08-25). Please send across the payment link.\n\nRegards,\nAcme Finance',
  },
  {
    messageId: 'msg_imap_demo_002',
    sender: 'billing@techflow.io',
    subject: 'Payment commitment regarding INV-2026-002',
    body: 'Hello,\nWe can pay 20,000 INR today towards invoice INV-2026-002. The rest will follow next month.\n\nThanks,\nTechFlow Accounts',
  },
  {
    messageId: 'msg_imap_demo_003',
    sender: 'unknown-vendor@externalcorp.com',
    subject: 'Query regarding pending services',
    body: 'Can someone please check the current balance on our account? We received an automated reminder yesterday.',
  },
];

/**
 * Polls incoming emails from IMAP or demo inbox feed, matches to invoices, and enqueues jobs.
 */
export async function pollInboxAndEnqueue(
  customMessages?: RawEmailMessage[],
): Promise<IngestionRunResult> {
  const messagesToProcess = customMessages || DEMO_INBOX_FEED;

  let matchedCount = 0;
  let unmatchedCount = 0;
  const createdJobs: IngestedEmailJob[] = [];

  const MAX_EMAIL_BODY_CHARS = parseInt(process.env.MAX_EMAIL_BODY_CHARS || '10000', 10);

  for (const msg of messagesToProcess) {
    // Truncate/sanitize oversized body
    const sanitizedBody =
      msg.body.length > MAX_EMAIL_BODY_CHARS
        ? msg.body.slice(0, MAX_EMAIL_BODY_CHARS)
        : msg.body;

    const matchResult = await matchIncomingEmailToInvoice({
      sender: msg.sender,
      subject: msg.subject,
      body: sanitizedBody,
    });

    const invoiceId = matchResult.matched && matchResult.invoice ? matchResult.invoice.id : null;
    const initialStatus = matchResult.matched && matchResult.invoice ? 'pending' : 'unmatched';

    if (matchResult.matched) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    const enqueueResult = await enqueueEmailJob({
      messageId: msg.messageId,
      sender: msg.sender,
      subject: msg.subject,
      body: sanitizedBody,
      invoiceId,
      status: initialStatus,
    });

    if (enqueueResult.ok) {
      createdJobs.push(enqueueResult.data);
    }
  }

  return {
    success: true,
    totalIngested: messagesToProcess.length,
    matchedCount,
    unmatchedCount,
    jobs: createdJobs,
    details: `Successfully ingested ${messagesToProcess.length} emails (${matchedCount} matched to invoices, ${unmatchedCount} routed to Unmatched Review Queue).`,
  };
}
