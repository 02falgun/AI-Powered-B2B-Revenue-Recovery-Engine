'use client';

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

export function AuditTimeline({ logs, className = '' }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div
        className={`p-8 text-center text-slate-500 text-xs bg-slate-950/40 border border-slate-800 rounded-xl ${className}`}
      >
        No audit log history recorded yet for this invoice.
      </div>
    );
  }

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Complete Audit Trail & Timeline History ({logs.length})
        </h3>
        <span className="text-xs font-mono text-emerald-400">Immutable Audit Record</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {logs.map((log) => {
          const dateStr = new Date(log.created_at).toLocaleString();
          const actionName = log.action;
          const actor = log.actor;

          let badgeColor = 'bg-slate-800 text-slate-300';
          let icon = '📌';

          if (actionName === 'EMAIL_PROCESSED') {
            badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            icon = '📩';
          } else if (actionName === 'PAYMENT_RECEIVED' || actionName === 'PAYMENT_VERIFIED') {
            badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            icon = '💳';
          } else if (
            actionName === 'PAYMENT_LINK_FAILED' ||
            actionName === 'EMAIL_PROCESSING_FAILED'
          ) {
            badgeColor = 'bg-red-500/20 text-red-300 border-red-500/30';
            icon = '⚠️';
          }

          return (
            <div key={log.id} className="relative space-y-1.5 group">
              {/* Node Icon Circle */}
              <div className="absolute -left-[31px] top-0.5 h-6 w-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs shadow-sm">
                {icon}
              </div>

              {/* Event Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${badgeColor}`}
                  >
                    {actionName}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Actor: {actor}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{dateStr}</span>
              </div>

              {/* Metadata Details Card */}
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-2">
                {Boolean(log.metadata?.policy_decision) && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 font-medium">Policy Decision:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        log.metadata.policy_decision === 'AUTO_RECOVER'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {String(log.metadata.policy_decision)}
                    </span>
                  </div>
                )}

                {Boolean(log.metadata?.policy_reason) && (
                  <div>
                    <span className="text-slate-500 font-medium block">Policy Reason:</span>
                    <p className="text-slate-300 font-sans text-[11px] mt-0.5">
                      {String(log.metadata.policy_reason)}
                    </p>
                  </div>
                )}

                {Boolean(log.metadata?.original_email) && (
                  <div>
                    <span className="text-slate-500 font-medium block">Raw Email Text Input:</span>
                    <p className="text-slate-400 font-mono text-[11px] italic bg-slate-900/60 p-2 rounded border border-slate-800 mt-1 line-clamp-3">
                      "{String(log.metadata.original_email)}"
                    </p>
                  </div>
                )}

                {Boolean(log.metadata?.short_url) && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-slate-500">Razorpay Payment Link:</span>
                    <a
                      href={String(log.metadata.short_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline font-mono"
                    >
                      {String(log.metadata.short_url)}
                    </a>
                  </div>
                )}

                {Boolean(log.metadata?.amount_paid_paise) && (
                  <div className="flex justify-between items-center text-xs text-emerald-400 font-mono">
                    <span>Payment Received:</span>
                    <span>₹{(Number(log.metadata.amount_paid_paise) / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
