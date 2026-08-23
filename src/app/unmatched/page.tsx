'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { UserNav } from '@/components/UserNav';
import type { IngestedEmailJob, Invoice } from '@/lib/types';

export default function UnmatchedQueuePage() {
  const [unmatchedJobs, setUnmatchedJobs] = useState<IngestedEmailJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [selectedInvoiceMap, setSelectedInvoiceMap] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [unmatchedRes, invoicesRes] = await Promise.all([
        fetch('/api/unmatched-emails'),
        fetch('/api/invoices'),
      ]);

      const unmatchedData = await unmatchedRes.json();
      const invoicesData = await invoicesRes.json();

      if (unmatchedData.success) {
        setUnmatchedJobs(unmatchedData.data);
      }
      if (invoicesData.success) {
        setInvoices(invoicesData.data);
      }
    } catch {
      console.warn('Failed to load unmatched queue data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleTriggerPoll() {
    setPolling(true);
    setNotification(null);
    try {
      const res = await fetch('/api/cron/ingest-emails', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotification(`Inbox polled successfully. ${data.details}`);
        await loadData();
      }
    } catch {
      setNotification('Failed to poll inbox.');
    } finally {
      setPolling(false);
    }
  }

  async function handleLinkEmail(jobId: string) {
    const targetInvoiceId = selectedInvoiceMap[jobId];
    if (!targetInvoiceId) {
      setNotification('Please select an invoice to link this email to.');
      return;
    }

    setAssigningId(jobId);
    setNotification(null);

    try {
      const res = await fetch(`/api/unmatched-emails/${jobId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: targetInvoiceId }),
      });

      const data = await res.json();
      if (data.success) {
        setNotification(data.message || 'Email successfully linked to invoice and queued.');
        // Trigger queue processing worker immediately
        await fetch('/api/cron/process-queue', { method: 'POST' });
        await loadData();
      } else {
        setNotification(data.error?.message || 'Failed to link email.');
      }
    } catch {
      setNotification('Network error while linking email.');
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div
      className="min-h-screen text-slate-50 font-sans selection:bg-[#3395FF] selection:text-white"
      style={{ background: '#060E1F' }}
    >
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[450px] rounded-full blur-[140px] opacity-25"
          style={{ background: 'radial-gradient(circle, #3395FF 0%, transparent 70%)' }}
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-[#7EC8E315] bg-[#060E1F]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo />
            </Link>
            <div className="h-4 w-px bg-[#7EC8E325]" />
            <span className="text-xs font-mono tracking-widest text-[#7EC8E3] uppercase">
              Unmatched Review Queue
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-[#7EC8E3] hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[#7EC8E325] hover:border-[#7EC8E350]"
            >
              ← Back to Invoices
            </Link>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Unmatched Buyer Emails
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#E5A93C20] text-[#E5A93C] border border-[#E5A93C40]">
                {unmatchedJobs.length} In Review
              </span>
            </h1>
            <p className="mt-1 text-sm text-[#7EC8E390]">
              Incoming emails where automated matching was uncertain. Review and manually assign to an overdue invoice.
            </p>
          </div>

          <button
            onClick={handleTriggerPoll}
            disabled={polling}
            className="self-start md:self-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#3395FF]/15 hover:bg-[#3395FF]/30 border border-[#3395FF]/40 text-[#7EC8E3] transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
          >
            <span className={`h-2 w-2 rounded-full ${polling ? 'bg-[#E5A93C] animate-ping' : 'bg-[#10B981]'}`} />
            {polling ? 'Polling Mailbox…' : 'Poll Mailbox Now'}
          </button>
        </div>

        {/* Notification banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl text-xs font-mono bg-[#3395FF]/10 border border-[#3395FF]/30 text-[#7EC8E3] flex justify-between items-center"
            >
              <span>{notification}</span>
              <button
                onClick={() => setNotification(null)}
                className="text-[#7EC8E3] hover:text-white font-bold ml-4 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="text-center py-20 text-xs font-mono text-[#7EC8E3]">
            Loading unmatched review queue…
          </div>
        ) : unmatchedJobs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-[#7EC8E315] bg-[#0A1628]/40 backdrop-blur-sm">
            <div className="text-3xl mb-2">📬</div>
            <h3 className="text-base font-semibold text-white">All Ingested Emails Matched</h3>
            <p className="text-xs text-[#7EC8E380] max-w-sm mx-auto mt-1">
              There are currently no unmatched emails requiring manual review. New buyer communications will automatically appear here if ambiguous.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {unmatchedJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl border border-[#7EC8E325] bg-[#0A1628]/60 backdrop-blur-md shadow-xl"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-[#7EC8E315]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[#7EC8E3] px-2 py-0.5 rounded bg-[#7EC8E315] border border-[#7EC8E330]">
                        {job.sender}
                      </span>
                      <span className="text-xs text-[#7EC8E360]">
                        Received: {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{job.subject}</h3>
                  </div>

                  {/* Manual Assignment Selector */}
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <select
                      value={selectedInvoiceMap[job.id] || ''}
                      onChange={(e) =>
                        setSelectedInvoiceMap({ ...selectedInvoiceMap, [job.id]: e.target.value })
                      }
                      className="text-xs bg-[#060E1F] border border-[#7EC8E335] text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-[#3395FF] flex-1 lg:w-64 cursor-pointer"
                    >
                      <option value="">-- Select Overdue Invoice --</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} ({inv.customerName} - ₹{(inv.outstandingAmountPaise / 100).toLocaleString()})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleLinkEmail(job.id)}
                      disabled={assigningId === job.id || !selectedInvoiceMap[job.id]}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3395FF] text-white hover:bg-[#3395FF]/90 transition-colors shadow disabled:opacity-40 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {assigningId === job.id ? 'Queuing…' : 'Assign & Queue →'}
                    </button>
                  </div>
                </div>

                {/* Email Body Preview */}
                <div className="mt-4 p-4 rounded-xl bg-[#060E1F]/70 border border-[#7EC8E315] text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {job.body}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
