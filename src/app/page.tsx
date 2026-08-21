'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function InvoicesPage() {
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
          setError(data.error?.message ?? 'Failed to load invoices');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error fetching invoices');
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navigation / Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-3xl font-bold tracking-tight text-white">RecoverAI</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Autonomous B2B Revenue Recovery Engine — Financial Control Portal
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-300">
            <span>Security Mode:</span>
            <span className="font-semibold text-emerald-400">Strict Policy Invariant Active</span>
          </div>
        </header>

        {/* Overview Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              System Status
            </span>
            <p className="text-xl font-semibold text-emerald-400">
              Phase 3 — Core Orchestration Live
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Policy Engine
            </span>
            <p className="text-xl font-semibold text-indigo-400">Sole AUTO_RECOVER Authority</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Money Math Standard
            </span>
            <p className="text-xl font-semibold text-amber-400">Integer Paise Exact Arithmetic</p>
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Overdue Invoices</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select an invoice to process buyer email payment intent
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded">
              {invoices.length} Invoices Found
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Loading overdue invoices...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-400 text-sm">Error: {error}</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No overdue invoices found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Invoice #</th>
                    <th className="px-6 py-3.5">Customer</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5">Outstanding Balance</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => {
                    const outstandingInr = (inv.outstandingAmountPaise / 100).toFixed(2);
                    const totalInr = (inv.totalAmountPaise / 100).toFixed(2);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-white">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-200">{inv.customerName}</div>
                          <div className="text-xs text-slate-400">{inv.customerEmail}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">₹{totalInr}</td>
                        <td className="px-6 py-4 font-mono font-semibold text-emerald-400">
                          ₹{outstandingInr}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              inv.status === 'overdue'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : inv.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-sm"
                          >
                            <span>Process Recovery Email</span>
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
