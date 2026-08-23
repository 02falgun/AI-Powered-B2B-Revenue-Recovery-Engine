'use client';

/**
 * Persistent Test Mode Banner — Physical Control Panel Edition (Phase P7).
 *
 * Clearly signals to operators, evaluators, and judges that the application
 * is strictly running in Razorpay Test Mode with non-settling simulated transactions.
 */
export function TestModeBanner() {
  return (
    <div
      role="banner"
      aria-label="Razorpay Test Mode Notice"
      className="w-full bg-[#18181B] text-[#FAFAFA] border-b-2 border-[#52525B] px-4 py-2 text-center select-none shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        {/* Left Indicator */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-[#FAFAFA] text-[#0D0D0E] shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          >
            ⚡ TEST MODE
          </span>
          <span className="font-bold tracking-tight text-[#E4E4E7]">
            NO REAL PAYMENTS · SIMULATED FINANCIAL ENVIRONMENT
          </span>
        </div>

        {/* Right Details */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#A1A1AA]">
          <span>Gateway: Razorpay Test Mode</span>
          <span className="text-[#52525B]">·</span>
          <span>Settlement: Mock No-Op</span>
        </div>
      </div>
    </div>
  );
}
