'use client';

import { motion } from 'framer-motion';

export interface AuditLogEntry {
  readonly id: string;
  readonly invoice_id: string;
  readonly action: string;
  readonly actor: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

interface AuditTimelineProps {
  readonly logs: ReadonlyArray<AuditLogEntry>;
  readonly className?: string;
}

type EventConfig = {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
};

function getEventConfig(actionName: string): EventConfig {
  if (actionName === 'EMAIL_PROCESSED') {
    return {
      color: '#3395FF',
      bgColor: '#3395FF20',
      borderColor: '#3395FF40',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 5l6 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    };
  }
  if (actionName === 'PAYMENT_RECEIVED' || actionName === 'PAYMENT_VERIFIED') {
    return {
      color: '#00C48C',
      bgColor: '#00C48C20',
      borderColor: '#00C48C40',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    };
  }
  if (actionName === 'PAYMENT_LINK_FAILED' || actionName === 'EMAIL_PROCESSING_FAILED') {
    return {
      color: '#F04E37',
      bgColor: '#F04E3720',
      borderColor: '#F04E3740',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 4.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7" cy="9.5" r="0.75" fill="currentColor" />
        </svg>
      ),
    };
  }
  return {
    color: '#7EC8E3',
    bgColor: '#7EC8E320',
    borderColor: '#7EC8E340',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      </svg>
    ),
  };
}

import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

/**
 * AuditTimeline — layered, elevated event cards with depth stagger.
 * Each event is a distinct, elevated card — not a flat item in a list.
 */
export function AuditTimeline({ logs, className = '' }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div
        className={`p-12 text-center text-[#1A2F55] text-sm rounded-2xl border border-dashed border-[#1A2F55] bg-[#0C1A3530] ${className}`}
      >
        <div className="space-y-2">
          <p className="text-[#7EC8E360] font-display font-semibold">No Audit History Yet</p>
          <p className="text-xs text-[#1A2F55]">
            Process an email to generate the first audit log entry for this invoice.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-5 font-sans ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#1A2F55]">
        <h3 className="text-sm font-bold text-white font-display tracking-tight">
          Complete Audit Trail ({logs.length} events)
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#00C48C]"
            style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}
            aria-hidden="true"
          />
          <span className="text-xs font-mono text-[#00C48C]">Immutable Record</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Connector line */}
        <div
          className="absolute left-[19px] top-4 bottom-4 w-px"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, #1A2F55 10%, #1A2F55 90%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 pl-10"
        >
          {logs.map((log) => {
            const config = getEventConfig(log.action);
            const dateStr = new Date(log.created_at).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <motion.div key={log.id} variants={cardVariants} className="relative">
                {/* Node dot — positioned on the connector line */}
                <div
                  className="absolute -left-[29px] top-3.5 h-[9px] w-[9px] rounded-full border-2 border-[#060E1F] flex items-center justify-center"
                  style={{
                    backgroundColor: config.color,
                    boxShadow: `0 0 6px ${config.color}60`,
                  }}
                  aria-hidden="true"
                />

                {/* Event card — elevated */}
                <div
                  className="rounded-xl border overflow-hidden shadow-surface hover:shadow-raised transition-shadow duration-300"
                  style={{
                    background: '#0C1A35',
                    borderColor: config.borderColor,
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    style={{ background: `${config.bgColor}` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: config.color }}>{config.icon}</span>
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color: config.color }}
                      >
                        {log.action}
                      </span>
                      <span className="text-[10px] text-[#7EC8E360] font-mono">
                        — {log.actor}
                      </span>
                    </div>
                    <time
                      dateTime={log.created_at}
                      className="text-[10px] font-mono text-[#1A2F55] flex-shrink-0"
                    >
                      {dateStr}
                    </time>
                  </div>

                  {/* Metadata details */}
                  <div className="px-4 py-3 space-y-2.5">
                    {Boolean(log.metadata?.policy_decision) && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#7EC8E360] font-mono">
                          Policy Decision
                        </span>
                        <span
                          className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
                            log.metadata.policy_decision === 'AUTO_RECOVER'
                              ? 'bg-[#00C48C20] text-[#00C48C] border border-[#00C48C40]'
                              : 'bg-[#F5A62320] text-[#F5A623] border border-[#F5A62340]'
                          }`}
                        >
                          {String(log.metadata.policy_decision)}
                        </span>
                      </div>
                    )}

                    {Boolean(log.metadata?.policy_reason) && (
                      <div>
                        <span className="text-[10px] text-[#7EC8E360] font-mono block mb-1">
                          Policy Reason
                        </span>
                        <p className="text-[11px] text-[#C4D4EC] leading-relaxed">
                          {String(log.metadata.policy_reason)}
                        </p>
                      </div>
                    )}

                    {Boolean(log.metadata?.original_email) && (
                      <div>
                        <span className="text-[10px] text-[#7EC8E360] font-mono block mb-1">
                          Email Input
                        </span>
                        <blockquote className="text-[11px] text-[#7EC8E380] font-mono italic bg-[#060E1F60] px-3 py-2 rounded-lg border border-[#1A2F5560] line-clamp-2">
                          &ldquo;{String(log.metadata.original_email)}&rdquo;
                        </blockquote>
                      </div>
                    )}

                    {Boolean(log.metadata?.short_url) && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#1A2F5550]">
                        <span className="text-[10px] text-[#7EC8E360] font-mono">Payment Link</span>
                        <a
                          href={String(log.metadata.short_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#00C48C] hover:text-[#00C48Ccc] font-mono underline underline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] rounded"
                        >
                          {String(log.metadata.short_url)}
                        </a>
                      </div>
                    )}

                    {Boolean(log.metadata?.amount_paid_paise) && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#1A2F5550]">
                        <span className="text-[10px] text-[#7EC8E360] font-mono">
                          Amount Recovered
                        </span>
                        <span className="text-sm font-bold font-mono text-[#00C48C]">
                          ₹{(Number(log.metadata.amount_paid_paise) / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
