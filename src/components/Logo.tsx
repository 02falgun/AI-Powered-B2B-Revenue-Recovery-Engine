'use client';

/**
 * RecoverAI Logo — Physical Control Center Edition (Pure Black & White)
 *
 * Mark concept: Milled geometric shield emblem with a precision engraved rupee recovery path.
 * Zero hue / pure monochrome.
 */

interface LogoProps {
  /** Scale the entire logo. Default 1. */
  readonly scale?: number;
  /** Show the wordmark alongside the mark. Default true. */
  readonly showWordmark?: boolean;
  /** Extra class names on the wrapper. */
  readonly className?: string;
}

export function Logo({ scale = 1, showWordmark = true, className = '' }: LogoProps) {
  const markSize = Math.round(32 * scale);
  const gap = Math.round(10 * scale);
  const titleSize = Math.round(17 * scale);
  const tagSize = Math.round(10 * scale);

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      style={{ gap: `${gap}px` }}
      role="img"
      aria-label="RecoverAI logo"
    >
      {/* SVG Mark — Precision Milled Emblem */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Outer Shield Bezel */}
        <path
          d="M16 2L4 7v8c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z"
          fill="#18181B"
          stroke="#FAFAFA"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Precision Core Bars of Rupee / Vault Symbol */}
        <line x1="11" y1="11" x2="21" y2="11" stroke="#FAFAFA" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="14.5" x2="19" y2="14.5" stroke="#FAFAFA" strokeWidth="1.5" strokeLinecap="round" />
        {/* Recovery Curve / Gauge Indicator */}
        <path
          d="M13 17.5 Q13 21.5 16.5 22 Q20 22.5 21 19.5"
          stroke="#FAFAFA"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        {/* Mechanical Center Contact Point */}
        <circle cx="21" cy="19.5" r="1.5" fill="#FAFAFA" />
      </svg>

      {/* Physical Wordmark & Sub-Title */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className="font-bold tracking-tight text-[#FAFAFA]"
              style={{ fontSize: `${titleSize}px`, fontFamily: 'var(--font-display)' }}
            >
              RECOVER<span className="font-light text-[#A1A1AA]">AI</span>
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
          </div>
          <span
            className="tracking-widest uppercase font-medium text-[#71717A] mt-0.5"
            style={{ fontSize: `${tagSize}px` }}
          >
            AR Control Center
          </span>
        </div>
      )}
    </div>
  );
}
