'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
import { PolicyGuardrailBreakdown } from '@/components/ui/PolicyGuardrailBreakdown';
import { AuditTimeline, type AuditLogEntry } from '@/components/ui/AuditTimeline';
import { RazorpayCheckoutButton } from '@/components/RazorpayCheckoutButton';

interface InvoiceData {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly totalAmountPaise: number;
  readonly outstandingAmountPaise: number;
  readonly currency: string;
  readonly status: string;
  readonly dueDate: string;
}

interface ProcessResult {
  readonly success: boolean;
  readonly failureCode?: string;
  readonly intent?: string;
  readonly confidence?: number;
  readonly rationale?: string;
  readonly evidence?: string;
  readonly decision?: 'AUTO_RECOVER' | 'HUMAN_REVIEW';
  readonly reason?: string;
  readonly guardrailTriggered?: string | null;
  readonly approvedAmountInr?: number | null;
  readonly approvedAmountPaise?: number | null;
  readonly paymentLinkUrl?: string | null;
  readonly paymentLinkId?: string | null;
  readonly error?: { readonly message: string; readonly code?: string };
}

/**
 * Requirement 2 Shortcuts: 3 example message presets
 */
const SHORTCUT_PRESETS = [
  {
    label: 'Partial Payment (50%)',
    description: 'Commits to paying half the outstanding invoice balance today.',
    text: `Hello, regarding invoice INV-2026-001, we can clear 50% of the balance today. Please send us the payment link for half the amount and we will process it immediately.`,
  },
  {
    label: 'Billing Dispute',
    description: 'Voices invoice rate dispute and refuses payment until corrected.',
    text: `We are disputing this invoice. The software license rate quoted was lower than billed on invoice INV-2026-001. We will NOT pay until this overcharge is corrected.`,
  },
  {
    label: 'Overpayment Attempt',
    description: 'Promises an amount exceeding outstanding balance (triggers Guardrail A).',
    text: `Hi Team, we will transfer 1,000,000 INR for invoice INV-2026-001 immediately. Please confirm receipt.`,
  },
];

export default function InvoiceSimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [auditLogs, setAuditLogs] = useState<ReadonlyArray<AuditLogEntry>>([]);
  const [emailText, setEmailText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [operatorError, setOperatorError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'simulator' | 'timeline'>('simulator');

  async function fetchInvoiceAndLogs() {
    try {
      const invRes = await fetch(`/api/invoices/${id}`);
      const invData = await invRes.json();

      if (invData.success && invData.invoice) {
        setInvoice(invData.invoice);
      } else {
        setOperatorError(
          'We were unable to locate this invoice in the accounts receivable database.',
        );
      }

      // Fetch audit logs
      const logsRes = await fetch(`/api/invoices/${id}/audit-logs`);
      const logsData = await logsRes.json();
      if (logsData.success && Array.isArray(logsData.auditLogs)) {
        setAuditLogs(logsData.auditLogs);
      }
    } catch {
      setOperatorError(
        'A network error occurred while loading invoice details. Please check your connection.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoiceAndLogs();
  }, [id]);

  async function handleProcessEmail() {
    if (!emailText.trim()) return;

    setProcessing(true);
    setResult(null);
    setOperatorError(null);

    try {
      const res = await fetch('/api/process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: id,
          email_text: emailText,
        }),
      });

      const data = (await res.json()) as ProcessResult;
      setResult(data);

      if (!data.success) {
        // Formatted Requirement 5 Finance Operator Error Language
        if (data.failureCode === 'ai_error') {
          setOperatorError(
            'We could not extract clear intent automatically from this email — routed to Human Review.',
          );
        } else if (data.failureCode === 'payment_error') {
          setOperatorError(
            'Payment gateway link creation encountered an error — routed to Human Review.',
          );
        } else if (data.failureCode === 'validation_error') {
          setOperatorError(
            'The provided buyer email contains invalid parameters — please check input formatting.',
          );
        } else {
          setOperatorError(
            'We could not verify this payment intent automatically — please review.',
          );
        }
      }

      // Refresh invoice data & audit log timeline
      await fetchInvoiceAndLogs();
    } catch {
      setOperatorError(
        'We could not process this email automatically due to a system connectivity issue — please try again.',
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-12 text-center text-sm font-sans flex flex-col items-center justify-center space-y-3">
        <span className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
        <p className="text-slate-400">Loading invoice details & audit history...</p>
      </div>
    );
  }

  if (operatorError && !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-12 text-center text-sm font-sans space-y-4 max-w-xl mx-auto flex flex-col items-center justify-center">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 w-full space-y-2">
          <p className="font-semibold">Notice for Finance Operator</p>
          <p className="text-xs">{operatorError}</p>
        </div>
        <Link href="/" className="text-xs text-indigo-400 hover:underline">
          &larr; Return to AR Dashboard
        </Link>
      </div>
    );
  }

  const outstandingInr = (invoice!.outstandingAmountPaise / 100).toFixed(2);
  const totalInr = (invoice!.totalAmountPaise / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-4"
          >
            <span>&larr;</span>
            <span>Back to AR Dashboard</span>
          </Link>

          {/* Invoice Summary Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold font-mono text-white">
                  {invoice!.invoiceNumber}
                </h1>
                <InvoiceStatusBadge status={invoice!.status} />
              </div>
              <p className="text-sm text-slate-400">
                {invoice!.customerName} &bull;{' '}
                <span className="font-mono text-xs">{invoice!.customerEmail}</span>
              </p>
              <div className="text-xs text-slate-500 font-mono">
                Due Date: {new Date(invoice!.dueDate).toLocaleDateString()}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-xl text-right space-y-2 min-w-[240px]">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">
                  Authoritative Outstanding Debt
                </span>
                <span className="text-3xl font-bold font-mono text-emerald-400">
                  ₹{outstandingInr}
                </span>
                <span className="text-xs text-slate-500 font-mono block">
                  Total Invoice Debt: ₹{totalInr}
                </span>
              </div>
              <RazorpayCheckoutButton
                amountPaise={invoice!.outstandingAmountPaise}
                invoiceId={invoice!.id}
                customerName={invoice!.customerName}
                customerEmail={invoice!.customerEmail}
                buttonText="Direct Standard Checkout"
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
                onPaymentSuccess={() => fetchInvoiceAndLogs()}
              />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`pb-3 px-4 font-semibold border-b-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Email Simulator & Decision Result
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Audit Trail Timeline</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {activeTab === 'timeline' ? (
          <AuditTimeline logs={auditLogs} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Email Simulator Screen (Requirement 2) */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Email Simulator</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paste buyer email or select a demo shortcut preset to run AI intent extraction
                    and policy validation.
                  </p>
                </div>

                {/* Requirement 2 Demo Shortcut Shortcuts */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Live Demo Shortcut Presets:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {SHORTCUT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEmailText(preset.text)}
                        className="text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors group"
                      >
                        <div className="flex justify-between items-center text-xs font-bold text-slate-200 group-hover:text-indigo-400">
                          <span>{preset.label}</span>
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-300">
                            Click to load &rarr;
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Buyer Overdue Email Text:
                  </span>
                  <textarea
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="Paste overdue invoice buyer email here..."
                    rows={7}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleProcessEmail}
                  disabled={processing || !emailText.trim()}
                  className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                      <span>Running AI Extraction & Policy Guardrails...</span>
                    </>
                  ) : (
                    <span>Process Email & Run Policy Check</span>
                  )}
                </button>
              </div>

              {/* Requirement 5 Finance Operator Error Banner */}
              {operatorError && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
                  <p className="font-semibold text-amber-400">Notice for Finance Operator:</p>
                  <p>{operatorError}</p>
                </div>
              )}
            </div>

            {/* Right Column: Decision Result Screen (Requirement 3) */}
            <div className="space-y-6">
              {!result ? (
                <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500 text-sm space-y-2">
                  <p className="font-medium text-slate-300">No Policy Execution Run Yet</p>
                  <p className="text-xs">
                    Select a shortcut preset on the left or paste an email and click "Process Email"
                    to view the intent extraction and policy decision.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Decision Badge Banner */}
                  <div
                    className={`border rounded-xl p-6 space-y-3 ${
                      result.decision === 'AUTO_RECOVER'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wider font-semibold">
                        Policy Decision Output
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                          result.decision === 'AUTO_RECOVER'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {result.decision ?? 'HUMAN_REVIEW'}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white">{result.reason}</p>

                    {result.approvedAmountInr && (
                      <div className="pt-3 border-t border-emerald-500/20 flex justify-between items-center text-xs">
                        <span className="text-slate-300">Approved Recovery Amount:</span>
                        <span className="font-mono font-bold text-xl text-emerald-400">
                          ₹{result.approvedAmountInr.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment CTA vs Human Review Plain-Language Notice */}
                  {result.decision === 'AUTO_RECOVER' && result.paymentLinkUrl ? (
                    <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-6 space-y-3 shadow-lg">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Razorpay Payment Link Generated</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Link ID:{' '}
                        <code className="text-slate-200 font-mono">{result.paymentLinkId}</code>
                      </p>
                      <a
                        href={result.paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-colors shadow-md"
                      >
                        <span>Open Razorpay Test Payment Link</span>
                        <span>&rarr;</span>
                      </a>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <span>⚠️</span>
                        <span>Human Review Explanation for Operator</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        We could not verify this payment intent automatically. The Policy Engine has
                        safely routed this invoice to{' '}
                        <strong className="text-amber-300">HUMAN_REVIEW</strong>. No automatic
                        payment links or money actions were issued.
                      </p>
                    </div>
                  )}

                  {/* AI Extraction Intent Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">
                      AI Intent Extraction Output
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Extracted Intent</span>
                        <span className="font-mono font-bold text-indigo-400 capitalize">
                          {result.intent ?? 'unknown'}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Confidence Score</span>
                        <span className="font-mono font-bold text-slate-200">
                          {result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : '0.0%'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium block">Rationale:</span>
                        <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 mt-1">
                          {result.rationale ?? 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">
                          Supporting Evidence Quote:
                        </span>
                        <blockquote className="italic text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 mt-1">
                          "{result.evidence ?? 'N/A'}"
                        </blockquote>
                      </div>
                    </div>
                  </div>

                  {/* Guardrails Breakdown Component */}
                  <PolicyGuardrailBreakdown
                    decision={result.decision ?? 'HUMAN_REVIEW'}
                    reason={result.reason ?? 'Policy evaluation completed'}
                    guardrailTriggered={result.guardrailTriggered}
                    confidence={result.confidence}
                    approvedAmountPaise={result.approvedAmountPaise}
                    outstandingAmountPaise={invoice!.outstandingAmountPaise}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
