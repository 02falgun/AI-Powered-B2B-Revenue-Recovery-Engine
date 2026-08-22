'use client';

/**
 * RecoverAI Logo — original SVG mark + wordmark
 *
 * Mark concept: a geometric shield with an integrated recovery arrow
 * that forms a stylized ₹ rupee symbol — "safe recovery of money".
 * Fills use CSS variables so it's themeable at any size.
 *
 * NOT a copy of Razorpay's logo — original work in their color family.
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
  const titleSize = Math.round(18 * scale);
  const tagSize = Math.round(10 * scale);

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      style={{ gap: `${gap}px` }}
      role="img"
      aria-label="RecoverAI logo"
    >
      {/* SVG Mark */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Shield body */}
        <path
          d="M16 2L4 7v8c0 6.6 5.1 12.8 12 14 6.9-1.2 12-7.4 12-14V7L16 2z"
          fill="#012652"
          stroke="#3395FF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Rupee-arrow composite mark inside shield */}
        {/* Horizontal bars of ₹ */}
        <line x1="11" y1="11" x2="21" y2="11" stroke="#3395FF" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="14.5" x2="19" y2="14.5" stroke="#3395FF" strokeWidth="1.5" strokeLinecap="round" />
        {/* Recovery arrow — a curved arrow going up-right then down, integrated with the rupee stroke */}
        <path
          d="M13 17.5 Q13 21.5 16.5 22 Q20 22.5 21 19.5"
          stroke="#3395FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Arrow head pointing right-upward */}
        <path
          d="M19.5 17.5 L21 19.5 L22.5 17.8"
          stroke="#3395FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Vertical stem of ₹ */}
        <line x1="13" y1="11" x2="13" y2="17.5" stroke="#3395FF" strokeWidth="2" strokeLinecap="round" />
        {/* Shield tip accent dot */}
        <circle cx="16" cy="26.5" r="1" fill="#3395FF" opacity="0.6" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: `${titleSize}px`,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Recover
            <span style={{ color: '#3395FF' }}>AI</span>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              fontWeight: 400,
              fontSize: `${tagSize}px`,
              color: '#3395FF99',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1.4,
            }}
          >
            Revenue Recovery
          </span>
        </div>
      )}
    </div>
  );
}
