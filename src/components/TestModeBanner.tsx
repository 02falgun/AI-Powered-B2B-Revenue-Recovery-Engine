'use client';

/**
 * Persistent Test Mode Banner — Phase P7.
 *
 * Requirements:
 * - Visible on every screen (rendered in root layout.tsx, above all page content)
 * - High-contrast so it cannot be missed against the dark chassis background
 * - Non-dismissible — operators must always see this during the Test Mode phase
 * - Clearly states no real payments settle
 *
 * Design: amber/yellow warning stripe, consistent with universal "warning / caution"
 * conventions. Uses inline Tailwind classes only — no new CSS tokens required.
 * The pulsing dot signals the environment is actively in test mode (not historical).
 */
export function TestModeBanner() {
  return (
    <div
      role="status"
      aria-label="Razorpay Test Mode is active — no real payments"
      className="w-full bg-amber-950 border-b-2 border-amber-600 px-4 py-2 select-none"
      style={{
        /* Inline fallback for environments where Tailwind JIT hasn't purged amber */
        backgroundColor: '#451a03',
        borderBottomColor: '#d97706',
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left: primary warning message */}
        <div className="flex items-center gap-2.5">
          {/* Pulsing amber LED dot */}
          <span
            className="relative flex h-2.5 w-2.5 shrink-0"
            aria-hidden="true"
          >
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: '#f59e0b' }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: '#f59e0b' }}
            />
          </span>

          {/* TEST MODE pill */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-black uppercase tracking-wider"
            style={{ backgroundColor: '#d97706', color: '#0D0D0E' }}
          >
            TEST MODE
          </span>

          {/* Warning copy */}
          <span
            className="text-xs font-bold tracking-tight"
            style={{ color: '#fde68a' }}
          >
            NO REAL PAYMENTS — Razorpay Test Mode only. Transactions do not settle.
          </span>
        </div>

        {/* Right: secondary technical detail */}
        <div
          className="flex items-center gap-3 text-[11px] font-mono shrink-0"
          style={{ color: '#fbbf24' }}
        >
          <span>Gateway: rzp_test_*</span>
          <span style={{ color: '#92400e' }}>·</span>
          <span>Settlement: Mock No-Op</span>
          <span style={{ color: '#92400e' }}>·</span>
          <span>KYC: Not required</span>
        </div>
      </div>
    </div>
  );
}
