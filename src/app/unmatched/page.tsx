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

      if (unmatchedData.success && Array.isArray(unmatchedData.data)) {
        setUnmatchedJobs(unmatchedData.data);
      }
      if (invoicesData.success && Array.isArray(invoicesData.invoices)) {
        setInvoices(invoicesData.invoices);
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
    <div className="min-h-screen font-sans bg-[#0D0D0E] text-[#FAFAFA] texture-chassis">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-[#26262B] bg-[#121214]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo scale={1} />
            <span className="text-[#383840] text-xs">/</span>
            <span className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
              Unmatched Review Queue
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="btn-mechanical-secondary px-3 py-1.5 rounded text-xs"
            >
              ← Ledger Console
            </Link>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#71717A] uppercase font-bold">
                COMMUNICATION DISPATCH
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#FAFAFA] tracking-tight font-display flex items-center gap-3">
              Unmatched Inbound Queue
              <span className="text-xs font-mono px-2.5 py-0.5 rounded border-2 border-[#71717A] bg-[#18181B] text-[#FAFAFA] font-bold">
                {unmatchedJobs.length} Pending Review
              </span>
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Inbound communications where automated heuristics required human operator verification.
            </p>
          </div>

          <button
            onClick={handleTriggerPoll}
            disabled={polling}
            className="btn-mechanical-primary self-start md:self-auto px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs"
          >
            {polling ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span>Polling Ingestion Engine...</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">⟳</span>
                <span>Poll Inbound Mailbox Now</span>
              </>
            )}
          </button>
        </div>

        {/* Status Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-4 rounded-lg panel-raised border border-[#52525B] text-xs font-mono flex items-center justify-between text-[#FAFAFA]"
            >
              <span>{notification}</span>
              <button
                onClick={() => setNotification(null)}
                className="text-[#71717A] hover:text-[#FAFAFA] font-bold text-sm"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="panel-raised p-6 rounded-xl space-y-4 animate-pulse">
                <div className="h-4 w-1/3 bg-[#202024] rounded" />
                <div className="h-16 w-full bg-[#161618] rounded" />
              </div>
            ))}
          </div>
        ) : unmatchedJobs.length === 0 ? (
          <div className="panel-recessed p-12 rounded-xl text-center space-y-3">
            <div className="text-3xl text-[#52525B]" aria-hidden="true">
              ✓
            </div>
            <h3 className="text-base font-bold text-[#FAFAFA] font-display">
              Review Queue Clear
            </h3>
            <p className="text-xs text-[#71717A] max-w-md mx-auto">
              All ingested buyer emails have been matched to invoices or processed by the policy pipeline.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {unmatchedJobs.map((job) => (
              <div
                key={job.id}
                className="panel-raised rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#26262B]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#FAFAFA]">
                        {job.sender || 'Unknown Sender'}
                      </span>
                      <span className="text-xs text-[#71717A] font-mono">
                        // {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] font-mono mt-0.5">
                      Subject: {job.subject || '(No Subject)'}
                    </p>
                  </div>
                  <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded border border-[#52525B] bg-[#18181B] text-[#FAFAFA] font-bold">
                    STATUS: UNMATCHED
                  </span>
                </div>

                {/* Email Content Snippet */}
                <div className="panel-recessed p-4 rounded-lg">
                  <p className="text-xs text-[#D4D4D8] font-mono whitespace-pre-wrap leading-relaxed">
                    {job.body}
                  </p>
                </div>

                {/* Assignment Controls */}
                <div className="flex flex-col gap-3 pt-2">
                  {/* Test Mode notice — this action routes to the payment policy pipeline */}
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-mono"
                    style={{ backgroundColor: '#451a03', borderLeft: '3px solid #d97706', color: '#fbbf24' }}
                    aria-label="Test Mode active — linking will trigger simulated payment processing only"
                  >
                    <span aria-hidden="true" style={{ color: '#d97706' }}>⚠</span>
                    <span>
                      <strong style={{ color: '#fde68a' }}>TEST MODE:</strong> Linking triggers the policy pipeline &amp; may generate a Razorpay Test payment link. No real funds settle.
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 max-w-md">
                      <select
                        value={selectedInvoiceMap[job.id] || ''}
                        onChange={(e) =>
                          setSelectedInvoiceMap({ ...selectedInvoiceMap, [job.id]: e.target.value })
                        }
                        className="w-full panel-recessed rounded px-3 py-2 text-xs text-[#FAFAFA] border border-[#383840] focus:border-[#FAFAFA] focus:outline-none font-mono"
                      >
                        <option value="">-- Select Target Overdue Invoice --</option>
                        {invoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} - {inv.customerName} (₹{(inv.outstandingAmountPaise / 100).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleLinkEmail(job.id)}
                      disabled={assigningId === job.id || !selectedInvoiceMap[job.id]}
                      className="btn-mechanical-primary px-4 py-2 rounded text-xs disabled:opacity-40"
                    >
                      {assigningId === job.id ? 'Linking...' : 'Link to Invoice & Queue'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
