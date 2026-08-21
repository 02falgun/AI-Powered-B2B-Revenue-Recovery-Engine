'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Banner */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <h1 className="text-3xl font-bold tracking-tight text-white">RecoverAI</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AR Dashboard
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Accounts Receivable Control Center & Autonomous Intent Recovery Portal
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Total Portfolio Debt
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                ₹{totalOutstandingINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Policy Engine Mode
            </span>
            <p className="text-lg font-semibold text-emerald-400">Deterministic Invariant</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Sole AUTO_RECOVER Authority
            </span>
            <p className="text-lg font-semibold text-indigo-400">lib/policy.ts Guardrails A-F</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Money Math Standard
            </span>
            <p className="text-lg font-semibold text-amber-400">Integer Paise Exact</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Webhook Protection
            </span>
            <p className="text-lg font-semibold text-sky-400">HMAC SHA256 Idempotent</p>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Accounts Receivable Portfolio</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select an overdue invoice to simulate buyer email payment intent and run policy
                validation.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              {invoices.length} Invoices Active
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm space-y-2">
              <span className="inline-block h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
              <p>Loading portfolio invoices...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-400 text-sm space-y-2">
              <p className="font-semibold">Unable to Load Portfolio</p>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No active invoices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Invoice ID</th>
                    <th className="px-6 py-4">Customer / Merchant</th>
                    <th className="px-6 py-4">Total Debt</th>
                    <th className="px-6 py-4">Outstanding Balance</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => {
                    const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);
                    const totalInr = (inv.totalAmountPaise / 100).toFixed(2);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-white">
                          <div>{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {inv.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-100">{inv.customerName}</div>
                          <div className="text-xs text-slate-400">{inv.customerEmail}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">₹{totalInr}</td>
                        <td className="px-6 py-4 font-mono font-bold text-lg text-emerald-400">
                          ₹{outstandingInr}
                        </td>
                        <td className="px-6 py-4">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-sm"
                          >
                            <span>Simulate Email</span>
                            <span>&rarr;</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
