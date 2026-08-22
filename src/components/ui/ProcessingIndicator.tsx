'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  { label: 'Parsing buyer email...', detail: 'Tokenising and cleaning input text' },
  { label: 'Running AI intent extraction...', detail: 'Gemini Flash analysing payment intent' },
  { label: 'Evaluating 6 policy guardrails...', detail: 'Deterministic invariant safety checks' },
] as const;

interface ProcessingIndicatorProps {
  readonly isProcessing: boolean;
}

/**
 * Multi-stage processing indicator for the email analysis pipeline.
 * Shows three labelled stages advancing over time while the API call
 * is in flight. Respects prefers-reduced-motion.
 */
export function ProcessingIndicator({ isProcessing }: ProcessingIndicatorProps) {
  const [stage, setStage] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!isProcessing) {
      setStage(0);
      setProgress(0);
      return;
    }

    // Advance stages with realistic timing
    const stageTimers = [
      setTimeout(() => setStage(1), 1800),
      setTimeout(() => setStage(2), 3500),
    ];

    // Animated progress bar
    let pct = 0;
    const progressInterval = setInterval(() => {
      pct = Math.min(pct + 0.8, 88); // Never hits 100 — resolves when API returns
      setProgress(pct);
    }, 80);

    return () => {
      stageTimers.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  }, [isProcessing]);

  if (!isProcessing) return null;

  const current = STAGES[Math.min(stage, STAGES.length - 1)];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Processing: ${current.label}`}
      className="rounded-xl border border-[#1A2F55] bg-[#0C1A35] p-4 space-y-3"
    >
      {/* Stage label */}
      <div className="flex items-center gap-3">
        {/* Animated dot */}
        <span className="relative flex h-3 w-3 flex-shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-[#3395FF] opacity-75"
            style={{ animation: 'pulse-ring 1.2s cubic-bezier(0,0,0.2,1) infinite' }}
          />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#3395FF]" />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-white font-display">{current.label}</p>
          <p className="text-[11px] text-[#7EC8E3] mt-0.5 font-mono">{current.detail}</p>
        </div>
      </div>

      {/* Stage pills */}
      <div className="flex gap-2">
        {STAGES.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all duration-300 ${
              i < stage
                ? 'bg-[#00C48C20] text-[#00C48C] border border-[#00C48C40]'
                : i === stage
                  ? 'bg-[#3395FF20] text-[#3395FF] border border-[#3395FF40]'
                  : 'bg-[#0F1F3D] text-[#1A2F55] border border-[#1A2F55]'
            }`}
          >
            {i < stage ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                <path d="M1.5 4l1.8 1.8L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : i === stage ? (
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                style={{ animation: 'pulse-ring 1s ease-in-out infinite' }}
              />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30" />
            )}
            <span className="truncate max-w-[80px]">{i === 0 ? 'Parse' : i === 1 ? 'Extract' : 'Evaluate'}</span>
          </div>
        ))}
      </div>

      {/* Progress bar — hidden for reduced-motion users */}
      <div
        className="h-0.5 w-full rounded-full bg-[#1A2F55] overflow-hidden motion-reduce:hidden"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[#3395FF] transition-all duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
