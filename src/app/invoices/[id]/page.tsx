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

/**
 * Requirement 2 Shortcuts: 3 example message presets
 */
const SHORTCUT_PRESETS = [
  {
    label: 'Partial Payment (50%)',
    description: 'Commits to paying half the outstanding invoice balance today.',
    intent: 'pay',
    text: `Hello, regarding invoice INV-2026-001, we can clear 50% of the balance today. Please send us the payment link for half the amount and we will process it immediately.`,
  },
  {
    label: 'Billing Dispute',
    description: 'Voices invoice rate dispute and refuses payment until corrected.',
    intent: 'dispute',
    text: `We are disputing this invoice. The software license rate quoted was lower than billed on invoice INV-2026-001. We will NOT pay until this overcharge is corrected.`,
  },
  {
    label: 'Overpayment Attempt',
    description: 'Promises an amount exceeding outstanding balance (triggers Guardrail A).',
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
        setOperatorError(
          'We were unable to locate this invoice in the accounts receivable database.',
        );
      }

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
    fetchUser();
  }, [id]);

  async function handleAdminOverride(newStatus: 'in_recovery' | 'paid' = 'in_recovery') {
    if (!currentUser || currentUser.role !== 'admin') {
      setOperatorError('Permission denied: Only administrators can manually override Human Review.');
      return;
    }

    setOverriding(true);
    setOverrideMessage(null);
    setOperatorError(null);

    try {
      const res = await fetch(`/api/invoices/${id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus,
          reason: `Manual administrative override approved by ${currentUser.email}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOverrideMessage(`Invoice status overridden to "${newStatus}" by Admin.`);
        await fetchInvoiceAndLogs();
      } else {
        setOperatorError(data.error?.message || 'Admin override failed.');
      }
    } catch {
      setOperatorError('Network error during admin override request.');
    } finally {
      setOverriding(false);
    }
  }

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
        if (data.failureCode === 'rate_limited') {
          setOperatorError(
            data.error?.message ||
              "You've hit the processing limit for this hour — please try again shortly.",
          );
        } else if (data.failureCode === 'ai_error') {
          setOperatorError(
            'We could not extract clear intent automatically from this email — routed to Human Review.',
          );
        } else if (data.failureCode === 'payment_error') {
          setOperatorError(
            'Payment gateway link creation encountered an error — routed to Human Review.',
          );
        } else if (data.failureCode === 'validation_error') {
          setOperatorError(
            data.error?.message ||
              'The provided buyer email contains invalid parameters — please check input formatting.',
          );
        } else {
          setOperatorError(
            'We could not verify this payment intent automatically — please review.',
          );
        }
      }

      await fetchInvoiceAndLogs();
    } catch {
      setOperatorError(
        'We could not process this email automatically due to a system connectivity issue — please try again.',
      );
    } finally {
      setProcessing(false);
    }
  }

  // ── Loading State ─────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 font-sans"
        style={{ background: '#060E1F' }}
        role="status"
        aria-label="Loading invoice"
      >
        <div
          className="h-8 w-8 rounded-full border-2 border-[#3395FF] border-t-transparent"
          style={{ animation: 'spin-smooth 0.8s linear infinite' }}
          aria-hidden="true"
        />
        <p className="text-sm text-[#7EC8E3] font-mono">Loading invoice & audit history…</p>
      </div>
    );
  }

  if (operatorError && !invoice) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 p-12 font-sans"
        style={{ background: '#060E1F' }}
      >
        <div
          className="max-w-md w-full p-5 rounded-xl border border-[#F04E3740] text-[#F04E37] space-y-2"
          style={{ background: '#F04E3710' }}
          role="alert"
        >
          <p className="font-semibold font-display">Notice for Finance Operator</p>
          <p className="text-xs leading-relaxed">{operatorError}</p>
        </div>
        <Link
          href="/"
          className="text-xs text-[#3395FF] hover:text-[#7EC8E3] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] rounded"
        >
          ← Return to AR Dashboard
        </Link>
      </div>
    );
  }

  const outstandingInr = (invoice!.outstandingAmountPaise / 100).toFixed(2);
  const totalInr = (invoice!.totalAmountPaise / 100).toFixed(2);

  return (
    <div className="min-h-screen font-sans" style={{ background: '#060E1F' }}>
      {/* ── Nav ───────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-[#1A2F55] backdrop-blur-md"
        style={{ background: 'rgba(6,14,31,0.88)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-[#7EC8E360] hover:text-[#7EC8E3] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] rounded"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M9 6H3m3-3L3 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Dashboard
            </Link>
            <span className="text-[#1A2F55] text-xs">/</span>
            <Logo scale={0.85} />
          </div>

          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Invoice Summary Card ──────────────────── */}
        <div
          className="rounded-2xl border border-[#1A2F55] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-floating"
          style={{
            background: 'linear-gradient(135deg, #0C1A35 0%, #112040 100%)',
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-white tracking-tight">
                {invoice!.invoiceNumber}
              </h1>
              <InvoiceStatusBadge status={invoice!.status} />
            </div>
            <p className="text-sm text-[#C4D4EC] font-display">
              {invoice!.customerName}
              <span className="text-[#7EC8E360] mx-2">·</span>
              <span className="font-mono text-xs">{invoice!.customerEmail}</span>
            </p>
            <p className="text-xs text-[#7EC8E360] font-mono">
              Due: {new Date(invoice!.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>

          <div
            className="rounded-xl border border-[#1A2F55] px-6 py-4 text-right space-y-3 min-w-[240px] relative overflow-hidden shadow-floating"
            style={{ background: '#060E1F' }}
          >
            {/* Mesh glow behind amount */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,140,0.08) 0%, transparent 70%)',
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
                Authoritative Outstanding Debt
              </span>
              <span
                className="text-3xl font-bold font-mono text-[#00C48C] block mt-1"
                style={{ textShadow: '0 0 20px rgba(0,196,140,0.35)' }}
              >
                ₹{outstandingInr}
              </span>
              <span className="text-xs text-[#7EC8E360] font-mono block mt-1">
                Total Invoice: ₹{totalInr}
              </span>
            </div>
            <div className="relative">
              <RazorpayCheckoutButton
                amountPaise={invoice!.outstandingAmountPaise}
                invoiceId={invoice!.id}
                customerName={invoice!.customerName}
                customerEmail={invoice!.customerEmail}
                buttonText="Direct Checkout"
                className="w-full py-2 px-3 rounded-lg text-white text-xs font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
                onPaymentSuccess={() => fetchInvoiceAndLogs()}
              />
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ───────────────────────── */}
        <div className="flex border-b border-[#1A2F55] text-sm gap-1">
          {(
            [
              { key: 'simulator' as const, label: 'Email Simulator & Decision Result', count: undefined },
              { key: 'timeline' as const, label: 'Audit Trail', count: auditLogs.length },
            ] satisfies ReadonlyArray<{ key: 'simulator' | 'timeline'; label: string; count: number | undefined }>
          ).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`pb-3 px-4 font-semibold font-display border-b-2 transition-all duration-200 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#3395FF] focus-visible:outline-offset-1 rounded-t ${
                activeTab === key
                  ? 'border-[#3395FF] text-white'
                  : 'border-transparent text-[#7EC8E360] hover:text-[#7EC8E3]'
              }`}
            >
              <span>{label}</span>
              {count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === key
                      ? 'bg-[#3395FF20] text-[#3395FF] border border-[#3395FF40]'
                      : 'bg-[#1A2F55] text-[#7EC8E360]'
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
              <div
                className="rounded-2xl border border-[#1A2F55] p-6 space-y-5 shadow-surface"
                style={{ background: '#0C1A35' }}
              >
                <div>
                  <h2 className="text-base font-bold text-white font-display">Email Simulator</h2>
                  <p className="text-xs text-[#7EC8E360] mt-0.5">
                    Paste a buyer email or select a demo preset to run AI intent extraction and policy validation.
                  </p>
                </div>

                {/* Shortcut presets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#7EC8E360] uppercase tracking-wider block">
                    Demo Presets
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {SHORTCUT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEmailText(preset.text)}
                        className="text-left p-3.5 rounded-xl border border-[#1A2F55] transition-all duration-200 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
                        style={{ background: '#060E1F' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#112040';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#3395FF40';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#060E1F';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1A2F55';
                        }}
                      >
                        <div className="flex justify-between items-center text-xs font-bold text-white font-display">
                          <span>{preset.label}</span>
                          <span className="text-[10px] text-[#3395FF60] font-mono transition-transform duration-200 group-hover:translate-x-0.5">
                            Load →
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7EC8E360] mt-1 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#7EC8E360] uppercase tracking-wider block">
                    Buyer Email Text
                  </span>
                  <textarea
                    id="email-input"
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="Paste buyer email here, or select a preset above…"
                    rows={7}
                    aria-label="Buyer email text input"
                    className="w-full rounded-xl border border-[#1A2F55] p-4 text-sm text-[#C4D4EC] placeholder:text-[#1A2F55] font-sans leading-relaxed resize-none transition-all duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#3395FF] focus-visible:outline-offset-0"
                    style={{
                      background: '#060E1F',
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#3395FF';
                      (e.currentTarget as HTMLTextAreaElement).style.boxShadow =
                        '0 0 0 3px rgba(51,149,255,0.15), 0 4px 16px rgba(51,149,255,0.1)';
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#1A2F55';
                      (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleProcessEmail}
                  disabled={processing || !emailText.trim()}
                  aria-label="Process email and run policy check"
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm font-display transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] motion-safe:hover:-translate-y-px"
                  style={{
                    background: processing ? '#0D5FBF' : '#3395FF',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(51,149,255,0.3)',
                  }}
                >
                  {processing ? (
                    <>
                      <span
                        className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                        style={{ animation: 'spin-smooth 0.8s linear infinite' }}
                        aria-hidden="true"
                      />
                      <span>Analysing…</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5 7l1.5 1.5L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Process Email & Run Policy Check</span>
                    </>
                  )}
                </button>
              </div>

              {/* Multi-stage processing indicator */}
              <ProcessingIndicator isProcessing={processing} />

              {/* Operator error banner */}
              <AnimatePresence>
                {operatorError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    role="alert"
                    className="p-4 rounded-xl border border-[#F5A62340] text-[#F5A623] space-y-1"
                    style={{ background: '#F5A62310' }}
                  >
                    <p className="font-semibold text-xs font-display flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M7 1.5L13 12H1L7 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M7 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="7" cy="10.5" r="0.75" fill="currentColor" />
                      </svg>
                      Notice for Finance Operator
                    </p>
                    <p className="text-[11px] leading-relaxed opacity-80">{operatorError}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: Decision Result ───────────── */}
            <div className="space-y-5">
              {!result ? (
                <div
                  className="rounded-2xl border border-dashed border-[#1A2F55] p-12 text-center space-y-3"
                  style={{ background: '#0C1A3530' }}
                >
                  <div
                    className="mx-auto h-12 w-12 rounded-full border border-[#1A2F55] flex items-center justify-center"
                    style={{ background: '#060E1F' }}
                    aria-hidden="true"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8.5" stroke="#1A2F55" strokeWidth="1.5" />
                      <path d="M10 6.5v5" stroke="#1A2F55" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="10" cy="14" r="1" fill="#1A2F55" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#7EC8E360] font-display">
                    No Policy Execution Yet
                  </p>
                  <p className="text-xs text-[#1A2F55] leading-relaxed">
                    Select a preset or paste an email and click "Process Email" to view the AI intent extraction and policy decision.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* Decision Badge Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="rounded-2xl border p-5 space-y-4"
                    style={{
                      background:
                        result.decision === 'AUTO_RECOVER'
                          ? 'linear-gradient(135deg, #00C48C0F 0%, #0C1A35 100%)'
                          : 'linear-gradient(135deg, #F5A6230F 0%, #0C1A35 100%)',
                      borderColor:
                        result.decision === 'AUTO_RECOVER' ? '#00C48C40' : '#F5A62340',
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-wider font-mono text-[#7EC8E360]">
                        Policy Decision Output
                      </span>
                      <motion.span
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono border ${
                          result.decision === 'AUTO_RECOVER'
                            ? 'bg-[#00C48C20] text-[#00C48C] border-[#00C48C50]'
                            : 'bg-[#F5A62320] text-[#F5A623] border-[#F5A62350]'
                        }`}
                        style={{
                          boxShadow:
                            result.decision === 'AUTO_RECOVER'
                              ? '0 0 12px rgba(0,196,140,0.3)'
                              : '0 0 12px rgba(245,166,35,0.3)',
                        }}
                      >
                        {result.decision ?? 'HUMAN_REVIEW'}
                      </motion.span>
                    </div>

                    <p className="text-sm font-semibold text-white font-display leading-relaxed">
                      {result.reason}
                    </p>

                    {result.approvedAmountInr && (
                      <div
                        className="pt-3 border-t flex justify-between items-center"
                        style={{
                          borderColor:
                            result.decision === 'AUTO_RECOVER' ? '#00C48C20' : '#F5A62320',
                        }}
                      >
                        <span className="text-xs text-[#7EC8E360] font-mono">
                          Approved Recovery Amount
                        </span>
                        <span
                          className="font-mono font-bold text-2xl text-[#00C48C]"
                          style={{ textShadow: '0 0 16px rgba(0,196,140,0.35)' }}
                        >
                          ₹{result.approvedAmountInr.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* Payment Link CTA or Human Review notice */}
                  {result.decision === 'AUTO_RECOVER' && result.paymentLinkUrl ? (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 }}
                      className="rounded-2xl border border-[#00C48C40] p-5 space-y-4 shadow-floating relative overflow-hidden"
                      style={{ background: '#0C1A35' }}
                    >
                      {/* Background glow */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,140,0.06) 0%, transparent 70%)',
                        }}
                        aria-hidden="true"
                      />
                      <div className="relative flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-[#00C48C]"
                          style={{ animation: 'pulse-ring 1.5s ease-in-out infinite' }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold text-[#00C48C] font-display">
                          Razorpay Payment Link Generated
                        </span>
                      </div>
                      <p className="relative text-xs text-[#7EC8E360] font-mono">
                        Link ID:{' '}
                        <code className="text-[#C4D4EC]">{result.paymentLinkId}</code>
                      </p>
                      <a
                        href={result.paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm font-display transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] motion-safe:hover:-translate-y-px"
                        style={{
                          background: '#00C48C',
                          color: '#060E1F',
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 16px rgba(0,196,140,0.35)',
                        }}
                      >
                        <span>Open Razorpay Test Payment Link</span>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 }}
                      className="rounded-2xl border border-[#F5A62340] p-5 space-y-4"
                      style={{ background: '#F5A62308' }}
                      role="alert"
                    >
                      <div className="flex items-center gap-2 text-[#F5A623]">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M8 1.5L14.5 13H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                        </svg>
                        <span className="text-sm font-semibold font-display">Human Review Required</span>
                      </div>
                      <p className="text-xs text-[#C4D4EC] leading-relaxed">
                        The Policy Engine has safely routed this invoice to{' '}
                        <strong className="text-[#F5A623]">HUMAN_REVIEW</strong>. No automatic
                        payment links or money actions were issued. A finance operator must review
                        and manually authorise any recovery action.
                      </p>

                      {/* Admin Override Action Section */}
                      <div className="pt-3 border-t border-[#F5A62325] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-[#7EC8E360] uppercase tracking-wider">
                            Access Control & Governance
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                              currentUser?.role === 'admin'
                                ? 'bg-[#3395FF20] text-[#3395FF] border-[#3395FF50]'
                                : 'bg-[#7EC8E315] text-[#7EC8E3] border-[#7EC8E340]'
                            }`}
                          >
                            Role: {currentUser?.role || 'Guest'}
                          </span>
                        </div>

                        {currentUser?.role === 'admin' ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleAdminOverride('in_recovery')}
                              disabled={overriding}
                              className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs font-display transition-all duration-200 flex items-center justify-center gap-2 border border-[#3395FF60] bg-[#3395FF] hover:bg-[#2575d6] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
                            >
                              {overriding ? (
                                <>
                                  <span
                                    className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white"
                                    style={{ animation: 'spin-smooth 0.8s linear infinite' }}
                                    aria-hidden="true"
                                  />
                                  <span>Authorizing Admin Override…</span>
                                </>
                              ) : (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                  <span>Authorize Manual Recovery (Admin Override)</span>
                                </>
                              )}
                            </button>
                            {overrideMessage && (
                              <p className="text-[11px] font-mono text-[#00C48C] text-center">
                                ✓ {overrideMessage}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl border border-[#1A2F55] bg-[#060E1F]/60 text-center">
                            <p className="text-[11px] text-[#7EC8E380] font-sans">
                              🔒 Manual review override requires <strong className="text-[#3395FF]">Administrator</strong> privileges. Operators have view and email processing access only.
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* AI Intent Extraction Card */}
                  <div
                    className="rounded-2xl border border-[#1A2F55] p-5 space-y-4 shadow-surface"
                    style={{ background: '#0C1A35' }}
                  >
                    <h3 className="text-sm font-bold text-white font-display">
                      AI Intent Extraction
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div
                        className="p-3 rounded-xl border border-[#1A2F55] space-y-1"
                        style={{ background: '#060E1F' }}
                      >
                        <span className="text-[10px] text-[#7EC8E360] font-mono block uppercase tracking-wider">
                          Extracted Intent
                        </span>
                        <span className="font-mono font-bold text-[#3395FF] capitalize text-sm">
                          {result.intent ?? 'unknown'}
                        </span>
                      </div>
                      <div
                        className="p-3 rounded-xl border border-[#1A2F55] space-y-1"
                        style={{ background: '#060E1F' }}
                      >
                        <span className="text-[10px] text-[#7EC8E360] font-mono block uppercase tracking-wider">
                          Confidence
                        </span>
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-white text-sm">
                            {result.confidence
                              ? `${(result.confidence * 100).toFixed(1)}%`
                              : '—'}
                          </span>
                          {result.confidence !== undefined && (
                            <div className="h-1 rounded-full bg-[#1A2F55] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${(result.confidence * 100).toFixed(0)}%`,
                                  background:
                                    result.confidence >= 0.7 ? '#3395FF' : '#F5A623',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#7EC8E360] font-mono block uppercase tracking-wider mb-1.5">
                          Rationale
                        </span>
                        <p
                          className="text-[#C4D4EC] rounded-xl border border-[#1A2F55] p-3 leading-relaxed"
                          style={{ background: '#060E1F' }}
                        >
                          {result.rationale ?? 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7EC8E360] font-mono block uppercase tracking-wider mb-1.5">
                          Supporting Evidence
                        </span>
                        <blockquote
                          className="italic text-[#7EC8E380] rounded-xl border border-[#1A2F55] p-3 leading-relaxed border-l-2 border-l-[#3395FF40]"
                          style={{ background: '#060E1F' }}
                        >
                          &ldquo;{result.evidence ?? 'N/A'}&rdquo;
                        </blockquote>
                      </div>
                    </div>
                  </div>

                  {/* Guardrail Circuit Board — THE SIGNATURE ELEMENT */}
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
