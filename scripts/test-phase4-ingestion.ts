import fs from 'fs';
import path from 'path';
import { matchIncomingEmailToInvoice } from '../src/lib/invoice-matcher';
import { pollInboxAndEnqueue } from '../src/lib/email-ingestion';
import { processNextEmailQueueBatch } from '../src/lib/queue-worker';
import { getUnmatchedEmailJobs, linkUnmatchedEmailToInvoice } from '../src/lib/db';
import { evaluatePolicy } from '../src/lib/policy';

function loadEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const k = key.trim();
          const v = rest.join('=').trim();
          if (k && v && !process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch {}
}

loadEnv();

async function runPhase4IngestionTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P4 Real Email Ingestion & Queue Verification ===');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean, details?: string): void {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      if (details) console.log(`     -> ${details}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      if (details) console.error(`     -> Error Details: ${details}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. High Confidence Matching (Explicit Invoice Identifier)
  // ---------------------------------------------------------------------------
  console.log('--- 1. HIGH-CONFIDENCE INVOICE MATCHING ---');

  const match1 = await matchIncomingEmailToInvoice({
    sender: 'finance@acmecorp.com',
    subject: 'Re: Overdue Invoice INV-2026-001 - Payment Schedule',
    body: 'We will pay 15000 INR on 2026-08-25.',
  });

  assert(
    'Matches explicit invoice number INV-2026-001 with High confidence',
    match1.matched === true &&
      match1.confidence === 'high' &&
      match1.invoice?.invoiceNumber === 'INV-2026-001',
    `Matched Invoice: ${match1.invoice?.invoiceNumber}, Confidence: ${match1.confidence}`,
  );

  // ---------------------------------------------------------------------------
  // 2. Medium Confidence Matching (Unique Sender Match)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. MEDIUM-CONFIDENCE SENDER MATCHING ---');

  const match2 = await matchIncomingEmailToInvoice({
    sender: 'billing@techflow.io',
    subject: 'Payment commitment update',
    body: 'We will transfer 45,500.50 INR tomorrow.',
  });

  assert(
    'Matches sender billing@techflow.io to unique overdue invoice INV-2026-002 with Medium confidence',
    match2.matched === true &&
      match2.confidence === 'medium' &&
      match2.invoice?.invoiceNumber === 'INV-2026-002',
    `Matched Invoice: ${match2.invoice?.invoiceNumber}`,
  );

  // ---------------------------------------------------------------------------
  // 3. Ambiguous / Unknown Sender Routed to Unmatched (No Forced Guessing)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. UNMATCHED QUEUE ROUTING (SAFE FAIL-CLOSED) ---');

  const match3 = await matchIncomingEmailToInvoice({
    sender: 'unregistered-client@domain.xyz',
    subject: 'Billing inquiry',
    body: 'Please check our balance.',
  });

  assert(
    'Routes unknown sender to unmatched state without forced guessing',
    match3.matched === false && match3.confidence === 'none' && match3.invoice === null,
    `Reason: ${match3.reason}`,
  );

  // ---------------------------------------------------------------------------
  // 4. Ingestion Polling & Queue Enqueue
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. INGESTION CONNECTOR & QUEUE ENQUEUE ---');

  const ingestRes = await pollInboxAndEnqueue([
    {
      messageId: `msg_test_${Date.now()}_1`,
      sender: 'finance@acmecorp.com',
      subject: 'Re: Invoice INV-2026-001 Payment Schedule',
      body: 'We will pay full balance of 15,000 INR on 2026-08-25.',
    },
    {
      messageId: `msg_test_${Date.now()}_2`,
      sender: 'random-stranger@nowhere.com',
      subject: 'Hello from marketing',
      body: 'Do you offer SEO services?',
    },
  ]);

  assert(
    'Ingestion polls and enqueues messages with matched/unmatched status partitioning',
    ingestRes.success === true &&
      ingestRes.totalIngested === 2 &&
      ingestRes.matchedCount === 1 &&
      ingestRes.unmatchedCount === 1,
    `Total: ${ingestRes.totalIngested}, Matched: ${ingestRes.matchedCount}, Unmatched: ${ingestRes.unmatchedCount}`,
  );

  // ---------------------------------------------------------------------------
  // 5. Unmatched Queue Listing & Manual Assignment
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. UNMATCHED QUEUE ASSIGNMENT ---');

  const unmatchedList = await getUnmatchedEmailJobs();
  assert(
    'Unmatched email jobs are retrievable by operator review queue',
    unmatchedList.ok === true && unmatchedList.data.length > 0,
    `Found ${unmatchedList.ok ? unmatchedList.data.length : 0} unmatched jobs.`,
  );

  if (unmatchedList.ok && unmatchedList.data.length > 0) {
    const jobToLink = unmatchedList.data[0];
    const linkRes = await linkUnmatchedEmailToInvoice(
      jobToLink.id,
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
    assert(
      'Operator can link unmatched email to an invoice, moving status to pending queue',
      linkRes.ok === true && linkRes.data.status === 'pending',
      `Linked Job ${jobToLink.id} to Invoice f47ac10b-58cc-4372-a567-0e02b2c3d479`,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Queue Worker Processing & Pipeline Execution
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. QUEUE WORKER EXECUTION ---');

  const workerRes = await processNextEmailQueueBatch(5);
  assert(
    'Queue worker dequeues pending jobs and executes intent extraction & policy evaluation',
    workerRes.success === true && workerRes.processedCount > 0,
    `Processed: ${workerRes.processedCount}, Succeeded: ${workerRes.succeededCount}`,
  );

  // ---------------------------------------------------------------------------
  // 7. Frozen Core Invariant Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. FROZEN CORE INVARIANT VERIFICATION ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 15000,
      promisedAmountPaise: 1500000,
      promisedDate: '2026-08-25',
      disputePresent: false,
      confidence: 0.95,
      rationale: 'Full payment promised',
      evidence: 'We will pay full balance',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 1500000,
  });

  assert(
    'Policy engine evaluatePolicy() remains sole authority for AUTO_RECOVER decisions',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 1500000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P4 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4IngestionTests().catch((err) => {
  console.error('Fatal error in Phase P4 tests:', err);
  process.exit(1);
});
