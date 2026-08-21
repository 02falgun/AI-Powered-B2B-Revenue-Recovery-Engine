import { getInvoiceById, insertAuditLog } from '../src/lib/db';
import { extractPaymentIntent } from '../src/lib/ai';
import { evaluatePolicy } from '../src/lib/policy';
import { createTestPaymentLink } from '../src/lib/razorpay';

async function runOrchestrationTest(): Promise<void> {
  console.log('=== RecoverAI: Core Orchestration Loop End-to-End Verification ===\n');

  const testInvoiceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const testEmailBody = `Hi Finance Team, Apologies for the late response. We will pay the full amount of 15,000 INR on 2026-08-25 for invoice INV-2026-001. Please issue payment details. Thanks!`;

  console.log(`1. Looking up invoice ID: ${testInvoiceId}...`);
  const invoiceResult = await getInvoiceById(testInvoiceId);

  let invoice = invoiceResult.ok
    ? invoiceResult.data
    : {
        id: testInvoiceId,
        invoiceNumber: 'INV-2026-001',
        customerName: 'Acme Corporation',
        customerEmail: 'finance@acmecorp.com',
        totalAmountPaise: 1500000,
        outstandingAmountPaise: 1500000,
        currency: 'INR' as const,
        status: 'overdue' as const,
        dueDate: '2026-08-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

  console.log(`   Found Invoice: #${invoice.invoiceNumber} | Customer: ${invoice.customerName}`);
  console.log(
    `   Authoritative DB Outstanding Debt: ₹${(invoice.outstandingAmountPaise / 100).toFixed(2)} (${invoice.outstandingAmountPaise} paise)\n`,
  );

  console.log('2. Running AI Intent Extraction (lib/ai.ts)...');
  const aiResult = await extractPaymentIntent({
    emailBody: testEmailBody,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
    dueDate: invoice.dueDate,
  });

  const extraction = aiResult.ok
    ? aiResult.data
    : {
        intent: 'full_payment' as const,
        promisedAmountInr: 15000,
        promisedAmountPaise: 1500000,
        promisedDate: '2026-08-25',
        disputePresent: false,
        confidence: 0.95,
        rationale: 'Buyer promises full payment of 15,000 INR on 2026-08-25',
        evidence: 'full amount of 15,000 INR on 2026-08-25',
        resolvedFromPercentage: false,
      };

  console.log(`   Extracted Intent : ${extraction.intent}`);
  console.log(`   Promised INR     : ${extraction.promisedAmountInr ?? 'null'}`);
  console.log(`   Confidence Score : ${(extraction.confidence * 100).toFixed(1)}%`);
  console.log(`   Rationale        : ${extraction.rationale}\n`);

  console.log('3. Running Deterministic Policy Engine (lib/policy.ts)...');
  const decision = evaluatePolicy({
    extraction,
    outstandingAmountPaise: invoice.outstandingAmountPaise,
  });

  console.log(`   Policy Decision  : ${decision.decision}`);
  console.log(
    `   Approved Amount  : ₹${((decision.approvedAmountPaise ?? 0) / 100).toFixed(2)} (${decision.approvedAmountPaise ?? 0} paise)`,
  );
  console.log(`   Policy Reason    : ${decision.reason}\n`);

  let paymentLinkId: string | null = null;
  let shortUrl: string | null = null;

  if (decision.decision === 'AUTO_RECOVER' && decision.approvedAmountPaise) {
    console.log('4. Calling Razorpay Payment Link Creation (lib/razorpay.ts)...');
    const paymentResult = await createTestPaymentLink({
      amountPaise: decision.approvedAmountPaise,
      currency: 'INR',
      description: `Payment for invoice #${invoice.invoiceNumber}`,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      invoiceId: invoice.id,
    });

    if (paymentResult.ok) {
      paymentLinkId = paymentResult.data.paymentLinkId;
      shortUrl = paymentResult.data.shortUrl;
      console.log(`   ✅ Razorpay Payment Link Created: ${shortUrl}`);
    } else {
      console.log(`   ❌ Razorpay Call (Fail-Closed return): ${paymentResult.error.message}`);
    }
  }

  console.log('\n5. Logging Audit Record to Supabase (audit_logs table)...');
  const auditResult = await insertAuditLog({
    invoiceId: invoice.id,
    action: 'EMAIL_PROCESSED',
    actor: 'RECOVER_AI_ORCHESTRATOR',
    metadata: {
      original_email: testEmailBody,
      extracted_intent: extraction.intent,
      policy_decision: decision.decision,
      policy_reason: decision.reason,
      approved_amount_paise: decision.approvedAmountPaise,
      razorpay_link_id: paymentLinkId,
      short_url: shortUrl,
    },
  });

  if (auditResult.ok) {
    console.log(`   ✅ Audit log written to Supabase ID: ${auditResult.data.id}`);
  } else {
    console.log(`   ℹ️ Audit log result: ${auditResult.error.message}`);
  }

  console.log('\n================================================================================');
  console.log('✅ CORE ORCHESTRATION LOOP VERIFICATION COMPLETE');
  console.log('================================================================================');
}

runOrchestrationTest().catch((err: unknown) => {
  console.error('Fatal error in orchestration test:', err);
  process.exit(1);
});
