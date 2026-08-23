'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
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

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[#26262B]">
      <div className="h-4 w-24 rounded bg-[#202024] animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-[#202024] animate-pulse" />
        <div className="h-2.5 w-48 rounded bg-[#18181B] animate-pulse" />
      </div>
      <div className="h-4 w-20 rounded bg-[#202024] animate-pulse" />
      <div className="h-6 w-24 rounded bg-[#202024] animate-pulse" />
      <div className="h-4 w-16 rounded bg-[#202024] animate-pulse" />
      <div className="h-8 w-28 rounded bg-[#202024] animate-pulse ml-auto" />
    </div>
  );
}

export default function ARDashboardPage() {
  const [invoices, setInvoices] = useState<ReadonlyArray<InvoiceItem>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices?page=${page}&limit=5`);
        const data = await res.json();
        if (data.success && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
          if (data.pagination) {
            setTotalPages(data.pagination.totalPages);
            setTotalCount(data.pagination.total);
          }
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
  }, [page]);

  const totalOutstandingINR =
    invoices.reduce((sum, inv) => sum + inv.outstandingAmountPaise, 0) / 100;

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const recoveryCount = invoices.filter((i) => i.status === 'in_recovery').length;

  return (
    <div className="min-h-screen text-[#FAFAFA] font-sans bg-[#0D0D0E] texture-chassis">
      {/* ── Top Industrial Control Header ──────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#26262B] bg-[#121214]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Logo scale={1} />

          <div className="flex items-center gap-3">
            {/* Telemetry Status Ingot */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-[#18181B] border border-[#2A2A30] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="h-2 w-2 rounded-full bg-[#FAFAFA]" aria-hidden="true" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4D4D8]">
                CORE ACTIVE
              </span>
            </div>

            {/* Recessed Portfolio Debt Gauge */}
            <div className="hidden md:flex flex-col items-end px-3.5 py-1 rounded panel-recessed">
              <span className="text-[9px] text-[#71717A] uppercase tracking-widest font-bold">
                PORTFOLIO DEBT
              </span>
              <span className="text-sm font-black font-mono text-[#FAFAFA]">
                ₹{totalOutstandingINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Unmatched Review Link */}
            <Link
              href="/unmatched"
              className="text-xs font-bold text-[#D4D4D8] hover:text-[#FAFAFA] transition-all px-3 py-1.5 rounded bg-[#1C1C20] hover:bg-[#26262B] border border-[#383840] shadow-[0_1px_2px_rgba(0,0,0,0.5)] active:translate-y-[1px] flex items-center gap-1.5"
            >
              <span aria-hidden="true">📬</span> Review Queue
            </Link>

            {/* User Session & Role */}
            <UserNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Console Header Title ────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
              CONSOLE 01 // MAIN LEDGER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#FAFAFA] tracking-tight font-display">
            Accounts Receivable Control Center
          </h1>
          <p className="text-sm text-[#A1A1AA]">
            Select an account from the ledger to engage AI intent analysis and deterministic guardrail policy checks.
          </p>
        </div>

        {/* ── 4 Physical Instrument Readout Gauges ──────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Gauge 1: Policy Engine Interlock */}
          <motion.div
            variants={cardVariants}
            className="panel-raised p-4 rounded-xl space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A1A1AA] tracking-tight">
                Policy Interlock
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#FAFAFA] font-display">DETERMINISTIC</p>
              <p className="text-[11px] text-[#71717A] font-mono mt-0.5">8 Guardrails Active</p>
            </div>
          </motion.div>

          {/* Gauge 2: Authority Level */}
          <motion.div
            variants={cardVariants}
            className="panel-raised p-4 rounded-xl space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A1A1AA] tracking-tight">
                Recovery Authority
              </span>
              <span className="text-[10px] font-mono font-bold text-[#FAFAFA] px-1.5 py-0.2 rounded bg-[#27272A] border border-[#3F3F46]">
                AUTO
              </span>
            </div>
            <div>
              <p className="text-lg font-bold text-[#FAFAFA] font-display">GUARDRAILS A–H</p>
              <p className="text-[11px] text-[#71717A] font-mono mt-0.5">lib/policy.ts Authority</p>
            </div>
          </motion.div>

          {/* Gauge 3: Overdue Accounts */}
          <motion.div
            variants={cardVariants}
            className="panel-raised p-4 rounded-xl space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A1A1AA] tracking-tight">
                Overdue Accounts
              </span>
              <span className="text-xs text-[#FAFAFA]" aria-hidden="true">⏱</span>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-[#FAFAFA]">
                {loading ? '—' : overdueCount}
              </p>
              <p className="text-[11px] text-[#71717A] font-mono mt-0.5">Immediate Focus</p>
            </div>
          </motion.div>

          {/* Gauge 4: Active In Recovery */}
          <motion.div
            variants={cardVariants}
            className="panel-raised p-4 rounded-xl space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A1A1AA] tracking-tight">
                Active Pipeline
              </span>
              <span className="text-xs text-[#FAFAFA]" aria-hidden="true">⟳</span>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-[#FAFAFA]">
                {loading ? '—' : recoveryCount}
              </p>
              <p className="text-[11px] text-[#71717A] font-mono mt-0.5">In Engagement</p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Main Ledger Chassis ─────────────────────────── */}
        <div className="panel-raised rounded-xl overflow-hidden">
          {/* Chassis Header Bar */}
          <div className="px-6 py-4 border-b border-[#26262B] bg-[#1A1A1E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#71717A] tracking-wider uppercase font-bold">
                  PORTFOLIO MATRIX
                </span>
              </div>
              <h2 className="text-base font-bold text-[#FAFAFA] font-display">
                Accounts Receivable Ledger
              </h2>
            </div>
            <div className="text-xs font-mono px-3 py-1 rounded panel-recessed text-[#D4D4D8]">
              {totalCount > 0 ? `${totalCount} Registered Invoices` : `${invoices.length} Active Records`}
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div aria-label="Loading invoices" role="status">
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center space-y-3" role="alert">
              <div className="inline-flex items-center gap-2 px-4 py-3 rounded bg-[#18181B] border-2 border-[#71717A] text-[#FAFAFA]">
                <span aria-hidden="true">▲</span>
                <span className="text-sm font-bold">Ledger Connection Warning</span>
              </div>
              <p className="text-xs text-[#A1A1AA]">{error}</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] text-sm">
              No active invoice records discovered in this company tenant.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-[#D4D4D8]">
                  <thead>
                    <tr className="text-[10px] text-[#71717A] uppercase tracking-wider border-b border-[#26262B] bg-[#121214] font-mono">
                      <th className="px-6 py-3.5">Invoice ID</th>
                      <th className="px-6 py-3.5">Debtor Entity</th>
                      <th className="px-6 py-3.5">Original Sum</th>
                      <th className="px-6 py-3.5">Outstanding Balance</th>
                      <th className="px-6 py-3.5">State</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Operation</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-[#26262B]"
                  >
                    {invoices.map((inv) => {
                      const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);
                      const totalInr = (inv.totalAmountPaise / 100).toFixed(2);

                      return (
                        <motion.tr
                          key={inv.id}
                          variants={cardVariants}
                          className="hover:bg-[#1E1E22] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-mono font-bold text-[#FAFAFA] text-sm">
                              {inv.invoiceNumber}
                            </div>
                            <div className="text-[10px] text-[#71717A] font-mono mt-0.5">
                              {inv.id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-[#FAFAFA] text-sm">
                              {inv.customerName}
                            </div>
                            <div className="text-xs text-[#71717A] mt-0.5">{inv.customerEmail}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[#A1A1AA] text-sm">
                            ₹{totalInr}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-black text-base text-[#FAFAFA]">
                              ₹{outstandingInr}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <InvoiceStatusBadge status={inv.status} />
                          </td>
                          <td className="px-6 py-4 text-xs text-[#A1A1AA] font-mono">
                            {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="btn-mechanical-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs"
                            >
                              <span>Simulate Email</span>
                              <span aria-hidden="true">→</span>
                            </Link>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-[#26262B]">
                {invoices.map((inv) => {
                  const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);

                  return (
                    <div key={inv.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono font-bold text-[#FAFAFA]">{inv.invoiceNumber}</div>
                          <div className="text-xs text-[#A1A1AA]">{inv.customerName}</div>
                        </div>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[10px] text-[#71717A] font-bold block uppercase">
                            Outstanding
                          </span>
                          <span className="text-lg font-black font-mono text-[#FAFAFA]">
                            ₹{outstandingInr}
                          </span>
                        </div>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="btn-mechanical-primary inline-flex items-center gap-1 px-3.5 py-1.5 rounded text-xs"
                        >
                          Simulate →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#26262B] bg-[#121214] text-xs text-[#A1A1AA]">
                <div className="font-mono">
                  Page <span className="font-bold text-[#FAFAFA]">{page}</span> of{' '}
                  <span className="font-bold text-[#FAFAFA]">{totalPages}</span> ({totalCount} items)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-mechanical-secondary px-3 py-1.5 rounded text-xs disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="btn-mechanical-secondary px-3 py-1.5 rounded text-xs disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-[#1E1E22]">
          <p className="text-[10px] font-mono text-[#52525B] uppercase tracking-wider">
            RecoverAI Control Center · Razorpay Buildathon · Pure Deterministic Policy
          </p>
        </footer>
      </main>
    </div>
  );
}
