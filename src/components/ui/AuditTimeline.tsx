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
  badgeStyles: string;
  icon: string;
  tag: string;
};

function getEventConfig(actionName: string): EventConfig {
  if (actionName === 'EMAIL_PROCESSED') {
    return {
      badgeStyles: 'bg-[#202024] text-[#FAFAFA] border border-[#383840]',
      icon: '✉',
      tag: 'INGESTION',
    };
  }
  if (actionName === 'PAYMENT_RECEIVED' || actionName === 'PAYMENT_VERIFIED') {
    return {
      badgeStyles: 'bg-[#FAFAFA] text-[#0D0D0E] border border-[#FFFFFF] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.5)]',
      icon: '✓',
      tag: 'PAYMENT',
    };
  }
  if (actionName === 'PAYMENT_LINK_FAILED' || actionName === 'EMAIL_PROCESSING_FAILED') {
    return {
      badgeStyles: 'bg-[#18181B] text-[#FAFAFA] border-2 border-[#71717A]',
      icon: '▲',
      tag: 'FAILURE',
    };
  }
  if (actionName === 'STATUS_OVERRIDDEN') {
    return {
      badgeStyles: 'bg-[#2A2A30] text-[#FAFAFA] border border-[#52525B]',
      icon: '⚙',
      tag: 'OVERRIDE',
    };
  }
  return {
    badgeStyles: 'bg-[#161618] text-[#A1A1AA] border border-[#27272A]',
    icon: '●',
    tag: 'SYSTEM',
  };
}

/**
 * Immutable Audit Ledger Timeline (Physical Monochrome Style).
 */
export function AuditTimeline({ logs, className = '' }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="panel-recessed rounded-xl p-8 text-center text-[#71717A]">
        <span className="text-2xl block mb-2" aria-hidden="true">
          ◷
        </span>
        <p className="text-sm font-medium">No ledger entries recorded yet.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-[#2E2E33]">
        {logs.map((log, index) => {
          const config = getEventConfig(log.action);
          const timestamp = new Date(log.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });

          return (
            <motion.div
              key={log.id || index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="relative group"
            >
              {/* Timeline Disc Marker */}
              <div
                className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#161618] border border-[#383840] flex items-center justify-center text-[10px] text-[#FAFAFA] select-none shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                aria-hidden="true"
              >
                {config.icon}
              </div>

              {/* Ledger Row Card */}
              <div className="panel-raised rounded-lg p-4 space-y-2 border border-[#26262B]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm ${config.badgeStyles}`}
                    >
                      {config.tag} // {log.action}
                    </span>
                    <span className="text-xs text-[#71717A] font-mono">
                      by {log.actor}
                    </span>
                  </div>
                  <time className="text-xs font-mono text-[#A1A1AA]">
                    {timestamp}
                  </time>
                </div>

                {/* Structured Metadata Output */}
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="panel-recessed rounded p-2.5 text-[11px] font-mono text-[#A1A1AA] overflow-x-auto">
                    <pre className="whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
