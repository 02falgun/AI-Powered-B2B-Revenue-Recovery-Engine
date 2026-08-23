'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { GuardrailResult } from '@/lib/policy';

interface PolicyGuardrailBreakdownProps {
  readonly decision: 'AUTO_RECOVER' | 'HUMAN_REVIEW' | string;
  readonly reason: string;
  readonly guardrailTriggered?: string | null;
  readonly guardrailResults?: readonly GuardrailResult[] | null;
  readonly confidence?: number;
  readonly approvedAmountPaise?: number | null;
  readonly outstandingAmountPaise?: number;
  readonly disputePresent?: boolean;
}

const DEFAULT_GUARDRAILS: readonly GuardrailResult[] = [
  {
    id: 'A',
    code: 'GUARDRAIL_A',
    label: 'OUTSTANDING CAP',
    description: 'Promised sum capped at authoritative DB balance',
    passed: true,
    evaluated: true,
    reason: 'Validated against ledger balance',
  },
  {
    id: 'B',
    code: 'GUARDRAIL_B',
    label: 'POSITIVE AMOUNT',
    description: 'Promised sum must be a positive integer in paise',
    passed: true,
    evaluated: true,
    reason: 'Positive monetary integer validated',
  },
  {
    id: 'C',
    code: 'GUARDRAIL_C',
    label: 'DISPUTE FILTER',
    description: 'Zero active dispute, price conflict, or counterclaim',
    passed: true,
    evaluated: true,
    reason: 'Clean settlement intent without dispute',
  },
  {
    id: 'D',
    code: 'GUARDRAIL_D',
    label: 'AI CONFIDENCE (>=0.7)',
    description: 'Extraction confidence score meets reliability floor',
    passed: true,
    evaluated: true,
    reason: 'Confidence score meets 0.70 threshold',
  },
  {
    id: 'E',
    code: 'GUARDRAIL_E',
    label: 'INPUT SANITY',
    description: 'Complete, well-formed input and positive integer balance',
    passed: true,
    evaluated: true,
    reason: 'Well-formed input payload structure',
  },
  {
    id: 'F',
    code: 'GUARDRAIL_F',
    label: 'SOLE AUTHORITY',
    description: 'Pure deterministic evaluator is sole recovery authority',
    passed: true,
    evaluated: true,
    reason: 'Sole authority invariant satisfied',
  },
  {
    id: 'G',
    code: 'GUARDRAIL_G',
    label: 'DB TRUTH LOCK',
    description: 'DB invoice facts source of truth over email claims',
    passed: true,
    evaluated: true,
    reason: 'Authoritative DB invoice context locked',
  },
  {
    id: 'H',
    code: 'GUARDRAIL_H',
    label: 'CURRENCY LOCK',
    description: 'Strict INR currency and valid percentage sanity',
    passed: true,
    evaluated: true,
    reason: 'Strict INR currency validated',
  },
];

/**
 * Fallback synthesizer for guardrail results if backend did not include guardrailResults.
 */
function deriveGuardrailsFromInputs(props: PolicyGuardrailBreakdownProps): readonly GuardrailResult[] {
  const isAutoRecover = props.decision === 'AUTO_RECOVER';
  if (isAutoRecover) {
    return DEFAULT_GUARDRAILS.map((g) => ({ ...g, passed: true, evaluated: true }));
  }

  const triggered = (props.guardrailTriggered || '').toUpperCase();
  const reason = props.reason || '';

  let failedId: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' = 'D';

  if (triggered.includes('GUARDRAIL_C') || props.disputePresent || reason.toLowerCase().includes('dispute')) {
    failedId = 'C';
  } else if (triggered.includes('GUARDRAIL_E') || reason.toLowerCase().includes('malformed') || reason.toLowerCase().includes('invalid')) {
    failedId = 'E';
  } else if (triggered.includes('GUARDRAIL_D') || (props.confidence !== undefined && props.confidence < 0.7) || reason.toLowerCase().includes('confidence')) {
    failedId = 'D';
  } else if (triggered.includes('GUARDRAIL_H') || reason.toLowerCase().includes('currency') || reason.toLowerCase().includes('usd')) {
    failedId = 'H';
  } else if (triggered.includes('GUARDRAIL_B') || reason.toLowerCase().includes('non-positive') || reason.toLowerCase().includes('zero')) {
    failedId = 'B';
  } else if (
    triggered.includes('GUARDRAIL_A') ||
    reason.toLowerCase().includes('exceeds') ||
    (props.approvedAmountPaise && props.outstandingAmountPaise && props.approvedAmountPaise > props.outstandingAmountPaise)
  ) {
    failedId = 'A';
  }

  // Evaluation sequence order: C -> E -> D -> H -> G -> B -> A -> F
  const evalOrder: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'> = ['C', 'E', 'D', 'H', 'G', 'B', 'A', 'F'];
  const failedIndex = evalOrder.indexOf(failedId);

  return DEFAULT_GUARDRAILS.map((g) => {
    const itemIndex = evalOrder.indexOf(g.id);
    if (g.id === failedId) {
      return {
        ...g,
        passed: false,
        evaluated: true,
        reason: props.reason || 'Failed policy check criteria',
      };
    }
    if (itemIndex < failedIndex) {
      return {
        ...g,
        passed: true,
        evaluated: true,
      };
    }
    return {
      ...g,
      passed: false,
      evaluated: false,
      reason: 'Not evaluated (short-circuited by preceding guardrail failure)',
    };
  });
}

/**
 * Unified Status Rocker Badge with flex-shrink: 0 and robust icon spacing.
 */
function GuardrailBadge({
  state,
  isFlipped,
}: {
  readonly state: 'passed' | 'failed' | 'idle';
  readonly isFlipped: boolean;
}) {
  if (!isFlipped) {
    return (
      <div className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-sm border select-none bg-[#18181B] text-[#52525B] border-[#27272A] min-w-[62px]">
        ---
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded-sm border select-none bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] shadow-[0_2px_4px_rgba(0,0,0,0.5)] min-w-[62px]">
        <span aria-hidden="true">▲</span>
        <span>TRIP</span>
      </div>
    );
  }

  if (state === 'passed') {
    return (
      <div className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-sm border select-none bg-[#27272A] text-[#FAFAFA] border-[#3F3F46] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] min-w-[62px]">
        <span aria-hidden="true">✓</span>
        <span>PASS</span>
      </div>
    );
  }

  // Idle state
  return (
    <div className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-sm border select-none bg-[#141416] text-[#71717A] border-[#26262B] min-w-[62px]">
      <span aria-hidden="true">—</span>
      <span>IDLE</span>
    </div>
  );
}

/**
 * PolicyGuardrailBreakdown — THE SIGNATURE ELEMENT (Full-Width Physical Annunciator Rack).
 *
 * Renders an 8-switch breaker annunciator rack spanning the full content width.
 * Each switch displays one of 3 distinct real-world states:
 * 1. PASSED: Checked and passed (clean illuminated plate).
 * 2. FAILED: Checked and failed (high-contrast flagged breaker with failure reason).
 * 3. NOT EVALUATED: Short-circuited / not reached (dimmed neutral idle state).
 */
export function PolicyGuardrailBreakdown(props: PolicyGuardrailBreakdownProps) {
  const { decision, reason, guardrailResults } = props;
  const isAutoRecover = decision === 'AUTO_RECOVER';
  const [flippedCount, setFlippedCount] = useState<number>(0);

  const activeGuardrails: readonly GuardrailResult[] =
    guardrailResults && guardrailResults.length === 8
      ? guardrailResults
      : deriveGuardrailsFromInputs(props);

  const failedGuardrail = activeGuardrails.find((g) => g.evaluated && !g.passed);

  // Stagger switch flip animations
  useEffect(() => {
    setFlippedCount(0);
    const timers: NodeJS.Timeout[] = [];
    activeGuardrails.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setFlippedCount((prev) => Math.max(prev, idx + 1));
      }, (idx + 1) * 50);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [decision, props.guardrailTriggered]);

  return (
    <div className="panel-raised p-6 rounded-xl space-y-6 w-full">
      {/* Control Bank Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#26262B]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-[#71717A] font-bold font-mono">
              ANNUNCIATOR PANEL // RACK-08
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
          </div>
          <h3 className="text-lg font-black text-[#FAFAFA] mt-1 font-display tracking-tight">
            Policy Engine Guardrail Interlocks (A–H)
          </h3>
        </div>

        {/* Master Outcome Ingot */}
        <div
          className={`px-4 py-2 rounded border flex items-center gap-2.5 select-none ${
            isAutoRecover
              ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] shadow-[0_2px_6px_rgba(0,0,0,0.6)] font-bold'
              : 'bg-[#18181B] text-[#FAFAFA] border-2 border-[#71717A] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] font-bold'
          }`}
        >
          <span className="text-base leading-none font-black" aria-hidden="true">
            {isAutoRecover ? '✓' : '▲'}
          </span>
          <div className="flex flex-col text-left">
            <span className="text-[10px] tracking-widest uppercase opacity-75 font-mono leading-none">
              DECISION OUTCOME
            </span>
            <span className="text-sm font-black tracking-wide leading-tight font-mono">
              {decision}
            </span>
          </div>
        </div>
      </div>

      {/* 8-Switch Annunciator Grid across 4 Full-Width Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {activeGuardrails.map((sw, index) => {
          const isFlipped = flippedCount > index;
          const isPassed = sw.evaluated && sw.passed;
          const isFailed = sw.evaluated && !sw.passed;
          const state: 'passed' | 'failed' | 'idle' = isFailed ? 'failed' : isPassed ? 'passed' : 'idle';

          return (
            <motion.div
              key={sw.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className={`p-4 rounded-lg border transition-all flex flex-col justify-between min-h-[140px] ${
                !isFlipped
                  ? 'bg-[#121214] border-[#202024] opacity-50'
                  : isFailed
                    ? 'bg-[#1A1A1E] border-2 border-[#FAFAFA] shadow-[0_0_14px_rgba(255,255,255,0.15),inset_0_2px_6px_rgba(0,0,0,0.9)] ring-1 ring-[#FAFAFA]'
                    : isPassed
                      ? 'bg-[#18181B] border-[#383840] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.4)]'
                      : 'bg-[#101012] border-[#202024] opacity-60'
              }`}
            >
              {/* Top Row: Flex container with flex-shrink:0 on badge to prevent ANY overlap */}
              <div className="flex items-start justify-between gap-3 w-full">
                {/* Left: Identifier Ingot + Multi-line Wrapping Title */}
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-black font-mono flex-shrink-0 mt-0.5 ${
                      isFailed
                        ? 'bg-[#FAFAFA] text-[#0D0D0E] font-black'
                        : isPassed
                          ? 'bg-[#27272A] border border-[#3F3F46] text-[#FAFAFA]'
                          : 'bg-[#18181B] text-[#71717A] border border-[#27272A]'
                    }`}
                  >
                    {sw.id}
                  </span>
                  <span
                    className={`text-xs font-bold tracking-tight leading-snug break-words flex-1 ${
                      isFailed ? 'text-[#FAFAFA] font-black' : isPassed ? 'text-[#E4E4E7]' : 'text-[#71717A]'
                    }`}
                  >
                    {sw.label}
                  </span>
                </div>

                {/* Right: Unified Status Badge Component */}
                <GuardrailBadge state={state} isFlipped={isFlipped} />
              </div>

              {/* Bottom Row: Detail / Telemetry Readout */}
              <div
                className={`mt-3 pt-2 border-t text-[11px] leading-tight font-mono ${
                  isFailed
                    ? 'border-[#52525B] text-[#FAFAFA] font-bold'
                    : isPassed
                      ? 'border-[#26262B]/80 text-[#A1A1AA]'
                      : 'border-[#1E1E22] text-[#52525B]'
                }`}
              >
                {!isFlipped
                  ? 'Polling...'
                  : isFailed
                    ? `✕ TRIP: ${sw.reason || 'Guardrail boundary tripped'}`
                    : isPassed
                      ? (sw.reason || 'Verified & satisfied')
                      : 'Not reached (short-circuited)'}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Physical Engraved Rationale Plate with Direct Card Linkage */}
      <div
        className={`p-4 rounded-lg flex items-start gap-3 border w-full ${
          failedGuardrail
            ? 'panel-raised border-2 border-[#71717A] bg-[#161618]'
            : 'panel-recessed border-[#26262B]'
        }`}
      >
        <div className="text-sm pt-0.5 select-none font-bold" aria-hidden="true">
          {failedGuardrail ? '▲' : 'ℹ'}
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-[#71717A] uppercase font-mono">
              POLICY ENGINE RATIONALE LOG
            </span>
            {failedGuardrail && (
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.2 rounded bg-[#FAFAFA] text-[#0D0D0E]">
                GUARDRAIL {failedGuardrail.id} TRIGGERED
              </span>
            )}
          </div>
          <p className="text-xs text-[#FAFAFA] font-mono leading-relaxed">
            {reason}
          </p>
        </div>
      </div>
    </div>
  );
}
