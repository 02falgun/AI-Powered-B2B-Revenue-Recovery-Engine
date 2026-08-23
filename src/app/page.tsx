'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
import { UserNav } from '@/components/UserNav';

interface InvoiceItem {
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

import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const metricVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-[#1A2F5540]">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3.5 w-36 rounded" />
        <div className="skeleton h-2.5 w-48 rounded" />
      </div>
      <div className="skeleton h-4 w-20 rounded" />
      <div className="skeleton h-7 w-28 rounded-full" />
      <div className="skeleton h-4 w-16 rounded" />
      <div className="skeleton h-8 w-28 rounded-xl ml-auto" />
    </div>
  );
}

export default function ARDashboardPage() {
  const [invoices, setInvoices] = useState<ReadonlyArray<InvoiceItem>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch('/api/invoices');
        const data = await res.json();
        if (data.success && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
        } else {
          setError(
            data.error?.message ??
              'We could not load your accounts receivable invoices at this time.',
          );
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error retrieving invoices');
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  const totalOutstandingINR =
    invoices.reduce((sum, inv) => sum + inv.outstandingAmountPaise, 0) / 100;

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const recoveryCount = invoices.filter((i) => i.status === 'in_recovery').length;

  return (
    <div
      className="min-h-screen text-slate-50 font-sans"
      style={{ background: '#060E1F' }}
    >
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#1A2F55] backdrop-blur-md"
        style={{ background: 'rgba(6,14,31,0.85)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Logo scale={1} />

          <div className="flex items-center gap-3">
            {/* Live status indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1A2F55] bg-[#0C1A35]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#00C48C]"
                style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}
                aria-hidden="true"
              />
              <span className="text-[11px] font-mono text-[#7EC8E3]">System Active</span>
            </div>

            {/* Total portfolio counter */}
            <div className="hidden md:block px-4 py-1.5 rounded-xl border border-[#1A2F55] bg-[#0C1A35] text-right shadow-surface">
              <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
                Portfolio Debt
              </span>
              <span className="text-sm font-bold font-mono text-[#00C48C]">
                ₹{totalOutstandingINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Unmatched Queue Navigation Link */}
            <Link
              href="/unmatched"
              className="text-xs font-medium text-[#E5A93C] hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[#E5A93C40] hover:border-[#E5A93C] bg-[#E5A93C10] flex items-center gap-1.5"
            >
              <span>📬</span> Unmatched Queue
            </Link>

            {/* User Session & Role Indicator */}
            <UserNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* ── Page Hero ────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-display text-white tracking-tight">
            Accounts Receivable Control Center
          </h1>
          <p className="text-sm text-[#7EC8E3]">
            Select an overdue invoice to run AI intent extraction and deterministic policy validation.
          </p>
        </div>

        {/* ── Metric Cards ─────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Policy Engine Mode */}
          <motion.div
            variants={metricVariants}
            className="rounded-xl border border-[#1A2F55] p-5 space-y-2 shadow-surface"
            style={{ background: '#0C1A35' }}
          >
            <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
              Policy Engine
            </span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00C48C]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#00C48C] font-display">Deterministic</p>
            </div>
            <p className="text-[10px] text-[#1A2F55] font-mono">Invariant Active</p>
          </motion.div>

          {/* Guardrail Authority */}
          <motion.div
            variants={metricVariants}
            className="rounded-xl border border-[#1A2F55] p-5 space-y-2 shadow-surface"
            style={{ background: '#0C1A35' }}
          >
            <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
              AUTO_RECOVER Authority
            </span>
            <p className="text-sm font-semibold text-[#3395FF] font-display">Guardrails A–F</p>
            <p className="text-[10px] text-[#1A2F55] font-mono">lib/policy.ts sole issuer</p>
          </motion.div>

          {/* Overdue count */}
          <motion.div
            variants={metricVariants}
            className="rounded-xl border border-[#F04E3730] p-5 space-y-2 shadow-surface"
            style={{ background: '#0C1A35' }}
          >
            <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
              Overdue Invoices
            </span>
            <p className="text-2xl font-bold font-mono text-[#F04E37]">
              {loading ? '—' : overdueCount}
            </p>
            <p className="text-[10px] text-[#1A2F55] font-mono">Require attention</p>
          </motion.div>

          {/* In recovery count */}
          <motion.div
            variants={metricVariants}
            className="rounded-xl border border-[#3395FF30] p-5 space-y-2 shadow-surface"
            style={{ background: '#0C1A35' }}
          >
            <span className="text-[10px] text-[#7EC8E360] uppercase tracking-wider font-mono block">
              In Recovery
            </span>
            <p className="text-2xl font-bold font-mono text-[#3395FF]">
              {loading ? '—' : recoveryCount}
            </p>
            <p className="text-[10px] text-[#1A2F55] font-mono">Active pipeline</p>
          </motion.div>
        </motion.div>

        {/* ── Invoice Table Card ───────────────────────────── */}
        <div
          className="rounded-2xl border border-[#1A2F55] overflow-hidden shadow-floating"
          style={{ background: '#0C1A35' }}
        >
          {/* Table header */}
          <div className="px-6 py-5 border-b border-[#1A2F55] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, #0C1A35 0%, #112040 100%)' }}
          >
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Accounts Receivable Portfolio
              </h2>
              <p className="text-xs text-[#7EC8E360] mt-0.5">
                Click "Simulate Email" on any invoice to run AI intent extraction and policy validation.
              </p>
            </div>
            <span className="self-start sm:self-auto text-xs font-mono bg-[#060E1F] text-[#7EC8E3] px-3 py-1.5 rounded-full border border-[#1A2F55]">
              {invoices.length} Active
            </span>
          </div>

          {/* Table body */}
          {loading ? (
            <div aria-label="Loading invoices" role="status">
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center space-y-3" role="alert">
              <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F04E3715] border border-[#F04E3740] text-[#F04E37]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                </svg>
                <span className="text-sm font-semibold">Unable to Load Portfolio</span>
              </div>
              <p className="text-xs text-[#7EC8E360]">{error}</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-[#7EC8E360] text-sm">
              No active invoices found in the accounts receivable database.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-[#C4D4EC]">
                  <thead>
                    <tr className="text-[10px] text-[#7EC8E360] uppercase tracking-wider border-b border-[#1A2F55] font-mono"
                      style={{ background: '#060E1F60' }}
                    >
                      <th className="px-6 py-3.5">Invoice</th>
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5">Total Debt</th>
                      <th className="px-6 py-3.5">Outstanding</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-[#1A2F5540]"
                  >
                    {invoices.map((inv) => {
                      const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);
                      const totalInr = (inv.totalAmountPaise / 100).toFixed(2);
                      const isHighValue = inv.outstandingAmountPaise > 50000 * 100;
                      const isOverdue = inv.status === 'overdue';

                      return (
                        <motion.tr
                          key={inv.id}
                          variants={cardVariants}
                          className="group transition-all duration-200"
                          style={{ cursor: 'default' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = '#112040';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = '';
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="font-mono font-bold text-white text-sm">
                              {inv.invoiceNumber}
                            </div>
                            <div className="text-[10px] text-[#1A2F55] font-mono mt-0.5">
                              {inv.id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white font-display text-sm">
                              {inv.customerName}
                            </div>
                            <div className="text-xs text-[#7EC8E360] mt-0.5">{inv.customerEmail}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[#7EC8E360] text-sm">
                            ₹{totalInr}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`font-mono font-bold text-lg ${
                                isHighValue ? 'text-[#F04E37]' : 'text-[#00C48C]'
                              }`}
                              style={
                                isHighValue
                                  ? { textShadow: '0 0 12px rgba(240,78,55,0.4)' }
                                  : isOverdue
                                    ? {}
                                    : { textShadow: '0 0 10px rgba(0,196,140,0.3)' }
                              }
                            >
                              ₹{outstandingInr}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <InvoiceStatusBadge status={inv.status} />
                          </td>
                          <td className="px-6 py-4 text-xs text-[#7EC8E360] font-mono">
                            {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold font-display transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] motion-safe:hover:-translate-y-px"
                              style={{
                                background: '#3395FF',
                                boxShadow:
                                  'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(51,149,255,0.3)',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.background = '#1d80f0';
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                                  'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 20px rgba(51,149,255,0.4)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.background = '#3395FF';
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                                  'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(51,149,255,0.3)';
                              }}
                            >
                              <span>Simulate Email</span>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M2.5 6h7m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </Link>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>

              {/* Mobile card layout */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="md:hidden divide-y divide-[#1A2F5540]"
              >
                {invoices.map((inv) => {
                  const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);
                  const isHighValue = inv.outstandingAmountPaise > 50000 * 100;

                  return (
                    <motion.div
                      key={inv.id}
                      variants={cardVariants}
                      className="p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono font-bold text-white">{inv.invoiceNumber}</div>
                          <div className="text-xs text-[#7EC8E360] mt-0.5">{inv.customerName}</div>
                        </div>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[#7EC8E360] font-mono block">Outstanding</span>
                          <span
                            className={`text-xl font-bold font-mono ${isHighValue ? 'text-[#F04E37]' : 'text-[#00C48C]'}`}
                          >
                            ₹{outstandingInr}
                          </span>
                        </div>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
                          style={{
                            background: '#3395FF',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                          }}
                        >
                          Simulate
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2.5 6h7m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <footer className="text-center space-y-1 pb-4">
          <p className="text-[10px] font-mono text-[#1A2F55]">
            RecoverAI — Razorpay Buildathon · AI Revenue Recovery Track · HMAC SHA256 Idempotent
          </p>
        </footer>
      </main>
    </div>
  );
}
