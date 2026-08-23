'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
import { PolicyGuardrailBreakdown } from '@/components/ui/PolicyGuardrailBreakdown';
import { AuditTimeline, type AuditLogEntry } from '@/components/ui/AuditTimeline';
import { RazorpayCheckoutButton } from '@/components/RazorpayCheckoutButton';
import { ProcessingIndicator } from '@/components/ui/ProcessingIndicator';
import { UserNav } from '@/components/UserNav';

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

const SHORTCUT_PRESETS = [
  {
    label: 'Partial Payment (50%)',
    description: 'Commits to clearing 50% of the outstanding invoice balance immediately.',
    intent: 'pay',
    text: `Hello, regarding invoice INV-2026-001, we can clear 50% of the balance today. Please send us the payment link for half the amount and we will process it immediately.`,
  },
  {
    label: 'Billing Dispute',
    description: 'Voices rate discrepancy and refuses payment until adjustment is verified.',
    intent: 'dispute',
    text: `We are disputing this invoice. The software license rate quoted was lower than billed on invoice INV-2026-001. We will NOT pay until this overcharge is corrected.`,
  },
  {
    label: 'Overpayment Commitment',
    description: 'Promises an amount exceeding ledger balance (trips Cap Guardrail).',
    intent: 'overpay',
    text: `Hi Team, we will transfer 1,000,000 INR for invoice INV-2026-001 immediately. Please confirm receipt.`,
  },
] as const;

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
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: 'admin' | 'operator' } | null>(null);
  const [overriding, setOverriding] = useState<boolean>(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch {
      // Guest or session refresh
    }
  }

  async function fetchInvoiceAndLogs() {
    try {
      const invRes = await fetch(`/api/invoices/${id}`);
      const invData = await invRes.json();

      if (invData.success && invData.invoice) {
        setInvoice(invData.invoice);
      } else {
        setOperatorError(invData.error?.message || 'Invoice record not located in this company tenant.');
      }

      const logsRes = await fetch(`/api/invoices/${id}/audit-logs`);
      const logsData = await logsRes.json();
      if (logsData.success && Array.isArray(logsData.audit_logs)) {
        setAuditLogs(logsData.audit_logs);
      }
    } catch (err: unknown) {
      setOperatorError(err instanceof Error ? err.message : 'Error fetching invoice metadata');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoiceAndLogs();
    fetchUser();
  }, [id]);

  async function handleAdminOverride(targetStatus: string) {
    if (!currentUser || currentUser.role !== 'admin') {
      setOverrideMessage('Admin access required to override ledger state.');
      return;
    }

    setOverriding(true);
    setOverrideMessage(null);
    try {
      const res = await fetch(`/api/invoices/${id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reason: 'Manual authorization by finance administrator via Control Center console.',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOverrideMessage(`Status updated to ${targetStatus.toUpperCase()} by Administrator.`);
        await fetchInvoiceAndLogs();
      } else {
        setOverrideMessage(`Override rejected: ${data.error?.message || 'Unauthorized'}`);
      }
    } catch {
      setOverrideMessage('Network failure attempting status override.');
    } finally {
      setOverriding(false);
    }
  }

  async function handleProcessEmail() {
    if (!emailText.trim() || processing) return;

    setProcessing(true);
    setOperatorError(null);
    setResult(null);

    try {
      const res = await fetch('/api/process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: id,
          email_text: emailText.trim(),
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setOperatorError('Rate limit exceeded: You have reached the hourly email processing quota. Please retry later.');
        return;
      }

      if (res.status === 403) {
        setOperatorError('Access Denied: Invoice belongs to another tenant partition.');
        return;
      }

      if (data.success) {
        setResult({
          success: true,
          intent: data.intent,
          confidence: data.confidence,
          rationale: data.rationale,
          evidence: data.evidence,
          decision: data.decision,
          reason: data.reason,
          guardrailTriggered: data.guardrailTriggered,
          approvedAmountInr: data.approvedAmountInr,
          approvedAmountPaise: data.approvedAmountPaise,
          paymentLinkUrl: data.paymentLinkUrl,
          paymentLinkId: data.paymentLinkId,
        });
      } else {
        setResult({
          success: false,
          failureCode: data.failureCode,
          intent: data.intent ?? 'unknown',
          confidence: data.confidence ?? 0,
          decision: data.decision ?? 'HUMAN_REVIEW',
          reason: data.reason ?? 'AI intent extraction failure. Routed to HUMAN_REVIEW.',
          guardrailTriggered: data.guardrailTriggered ?? 'GUARDRAIL_F',
          error: data.error,
        });

        if (data.failureCode === 'ai_error') {
          setOperatorError('Automated extraction could not resolve payment intent. Routed safely to HUMAN_REVIEW.');
        }
      }

      await fetchInvoiceAndLogs();
    } catch {
      setOperatorError('System connectivity error during email processing. Please retry.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0D0D0E] text-[#FAFAFA] font-sans">
        <div className="h-6 w-6 rounded-full border-2 border-[#FAFAFA] border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-[#A1A1AA]">INITIALIZING TELEMETRY...</p>
      </div>
    );
  }

  if (operatorError && !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-12 bg-[#0D0D0E] text-[#FAFAFA] font-sans">
        <div className="max-w-md w-full p-5 rounded-lg border-2 border-[#71717A] bg-[#18181B] space-y-2">
          <p className="font-bold text-sm text-[#FAFAFA]">OPERATOR ATTENTION REQUIRED</p>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">{operatorError}</p>
        </div>
        <Link
          href="/"
          className="btn-mechanical-secondary px-4 py-2 rounded text-xs"
        >
          ← Return to AR Console
        </Link>
      </div>
    );
  }

  const outstandingInr = (invoice!.outstandingAmountPaise / 100).toFixed(2);
  const totalInr = (invoice!.totalAmountPaise / 100).toFixed(2);

  return (
    <div className="min-h-screen font-sans bg-[#0D0D0E] text-[#FAFAFA] texture-chassis">
      {/* ── Top Nav ──────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#26262B] bg-[#121214]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
            >
              ← Ledger Console
            </Link>
            <span className="text-[#383840] text-xs">/</span>
            <Logo scale={0.85} />
          </div>

          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Invoice Instrument Summary Card ──────── */}
        <div className="panel-raised rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black font-mono text-[#FAFAFA] tracking-tight">
                {invoice!.invoiceNumber}
              </h1>
              <InvoiceStatusBadge status={invoice!.status} />
            </div>
            <p className="text-sm text-[#D4D4D8]">
              {invoice!.customerName}
              <span className="text-[#52525B] mx-2">·</span>
              <span className="font-mono text-xs text-[#A1A1AA]">{invoice!.customerEmail}</span>
            </p>
            <p className="text-xs text-[#71717A] font-mono">
              Settlement Horizon: {new Date(invoice!.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>

          {/* Authoritative Debt Gauge & Direct Gateway */}
          <div className="panel-recessed rounded-xl px-6 py-4 text-right space-y-3 min-w-[260px]">
            <div>
              <span className="text-[10px] text-[#71717A] uppercase tracking-widest font-bold block">
                AUTHORITATIVE OUTSTANDING DEBT
              </span>
              <span className="text-3xl font-black font-mono text-[#FAFAFA] block mt-1">
                ₹{outstandingInr}
              </span>
              <span className="text-xs text-[#71717A] font-mono block mt-0.5">
                Total Face Value: ₹{totalInr}
              </span>
            </div>
            <div>
              <RazorpayCheckoutButton
                amountPaise={invoice!.outstandingAmountPaise}
                invoiceId={invoice!.id}
                customerName={invoice!.customerName}
                customerEmail={invoice!.customerEmail}
                buttonText="Direct Checkout Gateway"
                onPaymentSuccess={() => fetchInvoiceAndLogs()}
              />
            </div>
          </div>
        </div>

        {/* ── Mode Selection Tabs ───────────────────── */}
        <div className="flex border-b border-[#26262B] text-sm gap-2">
          {(
            [
              { key: 'simulator' as const, label: 'Email Simulator & Interlocks', count: undefined },
              { key: 'timeline' as const, label: 'Audit Ledger', count: auditLogs.length },
            ] satisfies ReadonlyArray<{ key: 'simulator' | 'timeline'; label: string; count: number | undefined }>
          ).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`pb-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === key
                  ? 'border-[#FAFAFA] text-[#FAFAFA]'
                  : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
              }`}
            >
              <span>{label}</span>
              {count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    activeTab === key
                      ? 'bg-[#FAFAFA] text-[#0D0D0E] font-bold'
                      : 'bg-[#202024] text-[#A1A1AA]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────── */}
        {activeTab === 'timeline' ? (
          <AuditTimeline logs={auditLogs} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ── Left: Email Simulator ────────────── */}
            <div className="space-y-4">
              <div className="panel-raised rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#FAFAFA] font-display">
                    Buyer Communication Simulator
                  </h2>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    Inject buyer email text to test AI extraction and guardrail policy resolution.
                  </p>
                </div>

                {/* Simulation Presets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-wider block font-bold">
                    PRESET STIMULI
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {SHORTCUT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEmailText(preset.text)}
                        className="text-left p-3 rounded-lg border border-[#2A2A30] bg-[#121214] hover:bg-[#1C1C20] hover:border-[#3F3F46] active:translate-y-[1px] transition-all group"
                      >
                        <div className="flex justify-between items-center text-xs font-bold text-[#FAFAFA]">
                          <span>{preset.label}</span>
                          <span className="text-[10px] text-[#71717A] group-hover:text-[#FAFAFA] font-mono transition-colors">
                            Load Input →
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Raw Input Textarea */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-wider block font-bold">
                    RAW BUYER MESSAGE BODY
                  </span>
                  <textarea
                    id="email-input"
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="Paste communication payload here or select a preset..."
                    rows={7}
                    aria-label="Buyer email text input"
                    className="w-full panel-recessed rounded-lg p-4 text-sm text-[#FAFAFA] placeholder:text-[#52525B] font-mono leading-relaxed resize-none focus:border-[#FAFAFA] focus:outline-none transition-colors"
                  />
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleProcessEmail}
                  disabled={processing || !emailText.trim()}
                  className="btn-mechanical-primary w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-40"
                >
                  {processing ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      <span>Evaluating Policy Interlocks...</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">⚙</span>
                      <span>Process Email & Run Policy Interlocks</span>
                    </>
                  )}
                </button>
              </div>

              {/* Multi-stage Telemetry Indicator */}
              <ProcessingIndicator isProcessing={processing} />

              {/* Operator Warning Banner */}
              <AnimatePresence>
                {operatorError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    role="alert"
                    className="p-4 rounded-lg border-2 border-[#71717A] bg-[#18181B] space-y-1"
                  >
                    <p className="font-bold text-xs text-[#FAFAFA] flex items-center gap-2">
                      <span>▲</span> Notice for Operator
                    </p>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{operatorError}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: Decision Result ───────────── */}
            <div className="space-y-5">
              {!result ? (
                <div className="panel-recessed rounded-xl p-12 text-center space-y-3">
                  <div className="text-2xl text-[#52525B]" aria-hidden="true">
                    ⚙
                  </div>
                  <p className="text-sm font-bold text-[#A1A1AA]">
                    Awaiting Stimulus Evaluation
                  </p>
                  <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                    Input a buyer email on the left and engage the processor to trigger intent extraction and guardrail validation.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Decision Outcome Banner */}
                  <div className="panel-raised rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-widest font-mono text-[#71717A] font-bold">
                        EVALUATION SUMMARY
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-black font-mono rounded border ${
                          result.decision === 'AUTO_RECOVER'
                            ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                            : 'bg-[#18181B] text-[#FAFAFA] border-2 border-[#71717A]'
                        }`}
                      >
                        {result.decision ?? 'HUMAN_REVIEW'}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-[#FAFAFA] leading-relaxed">
                      {result.reason}
                    </p>

                    {result.approvedAmountInr && (
                      <div className="pt-3 border-t border-[#26262B] flex justify-between items-center">
                        <span className="text-xs text-[#A1A1AA] font-mono">
                          Approved Recovery Amount
                        </span>
                        <span className="font-mono font-black text-2xl text-[#FAFAFA]">
                          ₹{result.approvedAmountInr.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Link Generated or Human Review Notification */}
                  {result.decision === 'AUTO_RECOVER' && result.paymentLinkUrl ? (
                    <div className="panel-raised rounded-xl p-5 space-y-4 border border-[#52525B]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#FAFAFA]" aria-hidden="true" />
                          <span className="text-sm font-bold text-[#FAFAFA]">
                            Payment Link Issued
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202024] border border-[#52525B] text-[#FAFAFA] font-bold">
                          ⚡ TEST MODE LINK
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA] font-mono">
                        Reference: <code className="text-[#FAFAFA]">{result.paymentLinkId}</code>
                      </p>
                      <a
                        href={result.paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-mechanical-primary inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg text-sm"
                      >
                        <span>Open Razorpay Test Payment Link</span>
                        <span aria-hidden="true">→</span>
                      </a>
                      <div className="text-[10px] font-mono text-center text-[#71717A] pt-1">
                        Test Mode Only — Non-settling transaction simulation
                      </div>
                    </div>
                  ) : (
                    <div className="panel-raised rounded-xl p-5 space-y-4 border-2 border-[#71717A]" role="alert">
                      <div className="flex items-center gap-2 text-[#FAFAFA]">
                        <span aria-hidden="true">▲</span>
                        <span className="text-sm font-bold">Manual Human Review Required</span>
                      </div>
                      <p className="text-xs text-[#A1A1AA] leading-relaxed">
                        The Policy Engine routed this case to{' '}
                        <strong className="text-[#FAFAFA]">HUMAN_REVIEW</strong>. No automatic monetary actions or links were issued.
                      </p>

                      {/* Admin Override Action Section */}
                      <div className="pt-3 border-t border-[#26262B] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-wider font-bold">
                            GOVERNANCE CONTROL
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#202024] border border-[#383840] text-[#D4D4D8]">
                            Role: {currentUser?.role || 'Guest'}
                          </span>
                        </div>

                        {currentUser?.role === 'admin' ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleAdminOverride('in_recovery')}
                              disabled={overriding}
                              className="btn-mechanical-secondary w-full py-2.5 px-4 rounded text-xs"
                            >
                              {overriding ? 'Authorizing Admin Override...' : 'Authorize Manual Recovery (Admin Override)'}
                            </button>
                            {overrideMessage && (
                              <p className="text-[11px] font-mono text-[#FAFAFA] text-center">
                                ✓ {overrideMessage}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded panel-recessed text-center">
                            <p className="text-[11px] text-[#71717A]">
                              🔒 Status override requires <strong className="text-[#FAFAFA]">Administrator</strong> privileges.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Intent Extraction Readout */}
                  <div className="panel-raised rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-[#FAFAFA] font-display">
                      AI Intent Telemetry Readout
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="panel-recessed p-3 rounded-lg space-y-1">
                        <span className="text-[10px] text-[#71717A] font-mono block uppercase font-bold">
                          EXTRACTED INTENT
                        </span>
                        <span className="font-mono font-bold text-[#FAFAFA] capitalize text-sm">
                          {result.intent ?? 'unknown'}
                        </span>
                      </div>
                      <div className="panel-recessed p-3 rounded-lg space-y-1">
                        <span className="text-[10px] text-[#71717A] font-mono block uppercase font-bold">
                          CONFIDENCE
                        </span>
                        <span className="font-mono font-bold text-[#FAFAFA] text-sm">
                          {result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#71717A] font-mono block uppercase font-bold mb-1">
                          Rationale
                        </span>
                        <p className="text-[#D4D4D8] panel-recessed p-3 rounded leading-relaxed">
                          {result.rationale ?? 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717A] font-mono block uppercase font-bold mb-1">
                          Extracted Evidence
                        </span>
                        <blockquote className="italic text-[#A1A1AA] panel-recessed p-3 rounded leading-relaxed border-l-2 border-l-[#52525B]">
                          &ldquo;{result.evidence ?? 'N/A'}&rdquo;
                        </blockquote>
                      </div>
                    </div>
                  </div>

                  {/* 8-Switch Guardrail Annunciator Rack — SIGNATURE ELEMENT */}
                  <PolicyGuardrailBreakdown
                    decision={result.decision ?? 'HUMAN_REVIEW'}
                    reason={result.reason ?? 'Policy evaluation completed'}
                    guardrailTriggered={result.guardrailTriggered}
                    confidence={result.confidence}
                    approvedAmountPaise={result.approvedAmountPaise}
                    outstandingAmountPaise={invoice!.outstandingAmountPaise}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
