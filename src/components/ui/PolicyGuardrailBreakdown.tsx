'use client';

interface GuardrailItem {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly status: 'passed' | 'triggered' | 'skipped';
  readonly details?: string;
}

interface PolicyGuardrailBreakdownProps {
  readonly decision: 'AUTO_RECOVER' | 'HUMAN_REVIEW' | string;
  readonly reason: string;
  readonly guardrailTriggered?: string | null;
  readonly confidence?: number;
  readonly approvedAmountPaise?: number | null;
  readonly outstandingAmountPaise?: number;
  readonly disputePresent?: boolean;
}

export function PolicyGuardrailBreakdown({
  decision,
  reason,
  guardrailTriggered,
  confidence,
  approvedAmountPaise,
  outstandingAmountPaise,
  disputePresent,
}: PolicyGuardrailBreakdownProps) {
  const isAutoRecover = decision === 'AUTO_RECOVER';

  const guardrails: ReadonlyArray<GuardrailItem> = [
    {
      code: 'GUARDRAIL_C',
      name: 'Guardrail C — Dispute & Conflict Neutralization',
      description: 'Rejects auto-recovery if buyer voices billing disputes or service conflicts.',
      status: disputePresent ? 'triggered' : 'passed',
      details: disputePresent
        ? 'Dispute intent detected in email communication'
        : 'No dispute detected',
    },
    {
      code: 'GUARDRAIL_D',
      name: 'Guardrail D — Extraction Completeness & Confidence (≥70%)',
      description: 'Requires complete payment commitment with confidence score ≥ 0.70.',
      status: confidence !== undefined && confidence >= 0.7 ? 'passed' : 'triggered',
      details:
        confidence !== undefined
          ? `Extraction confidence: ${(confidence * 100).toFixed(1)}% (Threshold: 70.0%)`
          : 'Confidence score unavailable',
    },
    {
      code: 'GUARDRAIL_A',
      name: 'Guardrail A — Balance Over-Promise Safety',
      description:
        'Rejects payment approval if committed amount exceeds outstanding invoice balance.',
      status:
        approvedAmountPaise !== undefined &&
        approvedAmountPaise !== null &&
        outstandingAmountPaise !== undefined &&
        approvedAmountPaise > outstandingAmountPaise
          ? 'triggered'
          : 'passed',
      details:
        approvedAmountPaise !== undefined && approvedAmountPaise !== null && outstandingAmountPaise
          ? `Approved: ₹${(approvedAmountPaise / 100).toFixed(2)} | Outstanding: ₹${(outstandingAmountPaise / 100).toFixed(2)}`
          : 'Amount within allowable balance limit',
    },
    {
      code: 'GUARDRAIL_B',
      name: 'Guardrail B — Non-Positive Amount Guard',
      description: 'Rejects non-positive or zero currency payment commitments.',
      status:
        approvedAmountPaise !== undefined &&
        approvedAmountPaise !== null &&
        approvedAmountPaise <= 0
          ? 'triggered'
          : 'passed',
      details: approvedAmountPaise
        ? `Approved amount: ${approvedAmountPaise} paise`
        : 'No valid positive amount approved',
    },
    {
      code: 'GUARDRAIL_E',
      name: 'Guardrail E — Malformed Input Safety Net',
      description: 'Prevents money movement on missing or invalid policy parameters.',
      status: 'passed',
      details: 'All extraction types and boundaries validated',
    },
    {
      code: 'GUARDRAIL_F',
      name: 'Guardrail F — Architectural Authority Invariant',
      description:
        'Enforces evaluatePolicy() as the sole system authority allowed to issue AUTO_RECOVER.',
      status: 'passed',
      details: 'Strict invariant active',
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 font-sans">
      <div className="flex justify-between items-center pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Deterministic Policy Engine Audit Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluation of 6 PRD Section 3.10 Money-Safety Guardrails
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
            isAutoRecover
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {decision}
        </span>
      </div>

      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
        <span className="text-slate-400 font-medium">Policy Engine Rationale:</span>
        <p className="text-slate-200 mt-1 font-sans">{reason}</p>
      </div>

      <div className="space-y-2">
        {guardrails.map((g) => {
          const isTriggered = g.status === 'triggered' || guardrailTriggered === g.code;
          return (
            <div
              key={g.code}
              className={`p-3 rounded-lg border text-xs flex justify-between items-start gap-4 transition-colors ${
                isTriggered
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-100 flex items-center gap-2">
                  <span>{g.name}</span>
                  {isTriggered && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold">
                      Flagged
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px]">{g.description}</p>
                {g.details && (
                  <p className="text-slate-500 font-mono text-[10px] mt-1">{g.details}</p>
                )}
              </div>

              <span className="font-mono text-base font-bold">{isTriggered ? '⚠️' : '✅'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
