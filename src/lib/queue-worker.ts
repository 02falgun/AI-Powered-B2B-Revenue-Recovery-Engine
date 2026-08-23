import {
  getPendingEmailJobs,
  updateEmailJobStatus,
  getInvoiceById,
  insertAuditLog,
} from './db';
import { extractPaymentIntent } from './ai';
import { evaluatePolicy } from './policy';
import { createTestPaymentLink } from './razorpay';

export interface ProcessQueueResult {
  readonly success: boolean;
  readonly processedCount: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly jobs: Array<{
    readonly jobId: string;
    readonly invoiceId: string | null;
    readonly decision?: string;
    readonly status: string;
    readonly error?: string;
  }>;
}

/**
 * Worker that dequeues pending jobs and executes the exact same
 * AI extraction -> policy evaluation -> payment link pipeline.
 */
export async function processNextEmailQueueBatch(batchSize = 5): Promise<ProcessQueueResult> {
  const pendingResult = await getPendingEmailJobs(batchSize);
  if (!pendingResult.ok || pendingResult.data.length === 0) {
    return {
      success: true,
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      jobs: [],
    };
  }

  const jobsToProcess = pendingResult.data;
  const processedResults: ProcessQueueResult['jobs'] = [];
  let succeededCount = 0;
  let failedCount = 0;

  for (const job of jobsToProcess) {
    if (!job.invoiceId) {
      await updateEmailJobStatus(job.id, 'unmatched', 'No associated invoice.');
      processedResults.push({
        jobId: job.id,
        invoiceId: null,
        status: 'unmatched',
        error: 'Missing invoiceId',
      });
      continue;
    }

    await updateEmailJobStatus(job.id, 'processing');

    const invoiceResult = await getInvoiceById(job.invoiceId);
    if (!invoiceResult.ok) {
      await updateEmailJobStatus(job.id, 'failed', `Invoice ${job.invoiceId} not found.`);
      failedCount++;
      processedResults.push({
        jobId: job.id,
        invoiceId: job.invoiceId,
        status: 'failed',
        error: invoiceResult.error.message,
      });
      continue;
    }

    const invoice = invoiceResult.data;

    try {
      // 1. AI Intent Extraction (Identical pipeline)
      const aiResult = await extractPaymentIntent({
        emailBody: job.body,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        outstandingAmountPaise: invoice.outstandingAmountPaise,
        dueDate: invoice.dueDate,
      });

      if (!aiResult.ok) {
        await updateEmailJobStatus(job.id, 'failed', aiResult.error.message);
        failedCount++;
        processedResults.push({
          jobId: job.id,
          invoiceId: invoice.id,
          status: 'failed',
          error: aiResult.error.message,
        });
        continue;
      }

      const extraction = aiResult.data;

      // 2. Deterministic Policy Evaluation (Sole AUTO_RECOVER authority)
      const policyDecision = evaluatePolicy({
        extraction,
        outstandingAmountPaise: invoice.outstandingAmountPaise,
      });

      let paymentLink = null;
      if (policyDecision.decision === 'AUTO_RECOVER' && policyDecision.approvedAmountPaise) {
        const linkRes = await createTestPaymentLink({
          amountPaise: policyDecision.approvedAmountPaise,
          currency: 'INR',
          description: `Auto-Recovery for Invoice ${invoice.invoiceNumber}`,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          invoiceId: invoice.id,
        });

        if (linkRes.ok) {
          paymentLink = linkRes.data;
        }
      }

      // 3. Mandatory Audit Log
      await insertAuditLog({
        invoiceId: invoice.id,
        action: 'EMAIL_INGESTION_PROCESSED',
        actor: 'system_queue_worker',
        metadata: {
          job_id: job.id,
          message_id: job.messageId,
          intent: extraction.intent,
          policy_decision: policyDecision.decision,
          payment_link_id: paymentLink?.paymentLinkId ?? null,
          timestamp: new Date().toISOString(),
        },
      });

      await updateEmailJobStatus(job.id, 'completed');
      succeededCount++;
      processedResults.push({
        jobId: job.id,
        invoiceId: invoice.id,
        decision: policyDecision.decision,
        status: 'completed',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown worker processing error';
      await updateEmailJobStatus(job.id, 'failed', message);
      failedCount++;
      processedResults.push({
        jobId: job.id,
        invoiceId: invoice.id,
        status: 'failed',
        error: message,
      });
    }
  }

  return {
    success: true,
    processedCount: jobsToProcess.length,
    succeededCount,
    failedCount,
    jobs: processedResults,
  };
}
