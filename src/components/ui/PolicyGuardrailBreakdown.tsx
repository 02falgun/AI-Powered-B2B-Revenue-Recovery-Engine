'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface GuardrailSwitch {
  readonly letter: string;
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly isPassed: boolean;
  readonly details: string;
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

/**
 * PolicyGuardrailBreakdown — THE SIGNATURE ELEMENT (Physical Toggle-Switch Bank).
 *
 * Simulates an 8-switch breaker panel in an industrial instrument chassis.
 * Each switch (A–H) mechanically flips into position with a tactile click animation.
 * Grayscale only — state is distinguished via physical rocker position, embossed text, and iconography.
 */
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
  const [flippedCount, setFlippedCount] = useState<number>(0);

  // Compute 8 guardrail switch states
  const isDisputeTripped = Boolean(disputePresent || guardrailTriggered === 'GUARDRAIL_C');
  const isConfidenceTripped = Boolean((confidence !== undefined && confidence < 0.7) || guardrailTriggered === 'GUARDRAIL_F');
  const isThresholdTripped = Boolean(guardrailTriggered === 'GUARDRAIL_D');
  const isCapTripped = Boolean(
    (approvedAmountPaise && outstandingAmountPaise && approvedAmountPaise > outstandingAmountPaise) ||
    guardrailTriggered === 'GUARDRAIL_E',
  );
  const isAmountTripped = Boolean(guardrailTriggered === 'GUARDRAIL_A');
  const isDateTripped = Boolean(guardrailTriggered === 'GUARDRAIL_B');
  const isAdversarialTripped = Boolean(guardrailTriggered === 'GUARDRAIL_G');
  const isEntityTripped = Boolean(guardrailTriggered === 'GUARDRAIL_H');

  const switches: ReadonlyArray<GuardrailSwitch> = [
    {
      letter: 'A',
      code: 'GUARDRAIL_A',
      label: 'EXPLICIT AMOUNT',
      description: 'Definitive payable sum extracted from communication',
      isPassed: !isAmountTripped,
      details: !isAmountTripped ? 'Parsed monetary commitment' : 'Ambiguous or unstated payment sum',
    },
    {
      letter: 'B',
      code: 'GUARDRAIL_B',
      label: 'DATE WINDOW (<=30D)',
      description: 'Promised payment within 30 days of due date',
      isPassed: !isDateTripped,
      details: !isDateTripped ? 'Within allowed settlement horizon' : 'Promise date exceeds 30-day grace',
    },
    {
      letter: 'C',
      code: 'GUARDRAIL_C',
      label: 'DISPUTE FILTER',
      description: 'Zero active dispute, counterclaim, or conflict',
      isPassed: !isDisputeTripped,
      details: !isDisputeTripped ? 'Clean settlement intent' : 'Active billing dispute flagged',
    },
    {
      letter: 'D',
      code: 'GUARDRAIL_D',
      label: 'MIN 50% THRESHOLD',
      description: 'Promised recovery meets minimum 50% threshold',
      isPassed: !isThresholdTripped,
      details: !isThresholdTripped ? 'Threshold criteria satisfied' : 'Offer below 50% minimum',
    },
    {
      letter: 'E',
      code: 'GUARDRAIL_E',
      label: 'OUTSTANDING CAP',
      description: 'Approved amount capped at authoritative DB balance',
      isPassed: !isCapTripped,
      details: !isCapTripped ? 'Validated against ledger balance' : 'Exceeds ledger balance',
    },
    {
      letter: 'F',
      code: 'GUARDRAIL_F',
      label: 'AI CONFIDENCE (>=0.7)',
      description: 'Model extraction confidence meets reliability floor',
      isPassed: !isConfidenceTripped,
      details: !isConfidenceTripped ? `Confidence: ${Math.round((confidence || 0.95) * 100)}%` : 'Below 70% threshold',
    },
    {
      letter: 'G',
      code: 'GUARDRAIL_G',
      label: 'ADVERSARIAL GUARD',
      description: 'Immune to prompt injection and malicious override',
      isPassed: !isAdversarialTripped,
      details: !isAdversarialTripped ? 'Sanitized input stream' : 'Adversarial pattern blocked',
    },
    {
      letter: 'H',
      code: 'GUARDRAIL_H',
      label: 'ENTITY MATCH',
      description: 'Verified matching invoice and customer identifier',
      isPassed: !isEntityTripped,
      details: !isEntityTripped ? 'Authoritative entity lock' : 'Unmatched entity reference',
    },
  ];

  // Stagger switch flip animations
  useEffect(() => {
    setFlippedCount(0);
    const timers: NodeJS.Timeout[] = [];
    switches.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setFlippedCount((prev) => Math.max(prev, idx + 1));
      }, (idx + 1) * 75);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [decision, guardrailTriggered]);

  return (
    <div className="panel-raised p-6 rounded-xl space-y-6">
      {/* Control Bank Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#26262B]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-[#71717A] font-semibold">
              ANNUNCIATOR PANEL // RACK-08
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mt-1 font-display">
            Policy Engine Guardrail Interlocks
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
          <span className="text-base leading-none" aria-hidden="true">
            {isAutoRecover ? '✓' : '▲'}
          </span>
          <div className="flex flex-col text-left">
            <span className="text-[10px] tracking-widest uppercase opacity-75 font-mono leading-none">
              DECISION OUTCOME
            </span>
            <span className="text-sm font-black tracking-wide leading-tight">
              {decision}
            </span>
          </div>
        </div>
      </div>

      {/* 8-Switch Rocker Bank Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {switches.map((sw, index) => {
          const isFlipped = flippedCount > index;
          const passed = sw.isPassed;

          return (
            <motion.div
              key={sw.code}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between min-h-[125px] ${
                !isFlipped
                  ? 'bg-[#121214] border-[#202024] opacity-50'
                  : passed
                    ? 'bg-[#18181B] border-[#383840] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.4)]'
                    : 'bg-[#141416] border-2 border-[#71717A] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]'
              }`}
            >
              {/* Top Row: Switch Plate Identifier & Status Rocker */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#27272A] border border-[#3F3F46] text-xs font-black font-mono text-[#FAFAFA]">
                    {sw.letter}
                  </span>
                  <span className="text-xs font-bold tracking-tight text-[#E4E4E7]">
                    {sw.label}
                  </span>
                </div>

                {/* Tactile Rocker Indicator */}
                <div
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-sm border ${
                    !isFlipped
                      ? 'bg-[#18181B] text-[#52525B] border-[#27272A]'
                      : passed
                        ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                        : 'bg-[#202024] text-[#FAFAFA] border-[#71717A] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]'
                  }`}
                >
                  {!isFlipped ? '---' : passed ? '✓ ON' : '▲ TRIP'}
                </div>
              </div>

              {/* Bottom Row: Detail readout */}
              <div className="mt-3 pt-2 border-t border-[#26262B]/80 text-[11px] leading-tight text-[#A1A1AA]">
                {isFlipped ? sw.details : 'Awaiting interlock poll...'}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Physical Engraved Reason Plate */}
      <div className="panel-recessed p-4 rounded-lg flex items-start gap-3">
        <div className="text-sm text-[#A1A1AA] pt-0.5 select-none" aria-hidden="true">
          ℹ
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-wider text-[#71717A] uppercase">
            POLICY ENGINE RATIONALE LOG
          </div>
          <p className="text-xs text-[#E4E4E7] leading-relaxed">
            {reason}
          </p>
        </div>
      </div>
    </div>
  );
}
