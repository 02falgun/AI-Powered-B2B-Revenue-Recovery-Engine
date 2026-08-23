'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  { label: 'Ingesting buyer payload...', detail: 'Tokenising and cleaning input text' },
  { label: 'Running AI intent extraction...', detail: 'Gemini Flash analyzing settlement intent' },
  { label: 'Evaluating 8 policy guardrail interlocks...', detail: 'Deterministic safety boundary checks' },
] as const;

interface ProcessingIndicatorProps {
  readonly isProcessing: boolean;
}

/**
 * Multi-stage processing indicator for the pipeline.
 * Formatted like an industrial telemetry sequence readout in strict grayscale.
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

    const stageTimers = [
      setTimeout(() => setStage(1), 1800),
      setTimeout(() => setStage(2), 3500),
    ];

    let pct = 0;
    const progressInterval = setInterval(() => {
      pct = Math.min(pct + 1.2, 88);
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
      className="panel-raised p-5 rounded-xl space-y-4"
    >
      {/* Header telemetry readout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#FAFAFA] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#FAFAFA]">
            {current.label}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-[#A1A1AA]">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Recessed Progress Bar */}
      <div className="w-full h-2 rounded panel-recessed overflow-hidden p-0.5">
        <div
          className="h-full rounded-sm bg-[#FAFAFA] transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Sequential stage indicators */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#26262B]">
        {STAGES.map((s, idx) => {
          const isDone = idx < stage;
          const isCurrent = idx === stage;
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm border ${
                    isDone
                      ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF]'
                      : isCurrent
                        ? 'bg-[#202024] text-[#FAFAFA] border-[#52525B]'
                        : 'bg-[#121214] text-[#52525B] border-[#1E1E22]'
                  }`}
                >
                  {isDone ? '✓' : `0${idx + 1}`}
                </span>
                <span
                  className={`text-[11px] font-bold tracking-tight truncate ${
                    isDone || isCurrent ? 'text-[#FAFAFA]' : 'text-[#52525B]'
                  }`}
                >
                  Stage {idx + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
