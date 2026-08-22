'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'caution';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
  readonly children: React.ReactNode;
}

/**
 * PrimaryButton — RecoverAI design system button.
 * Three variants: primary (rzp-electric fill), secondary (outline), caution (amber).
 * All have: focus-visible ring, hover elevation lift, bevel, prefers-reduced-motion safe.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(
    { variant = 'primary', isLoading = false, className = '', children, disabled, ...rest },
    ref,
  ) {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm ' +
      'transition-all duration-200 ease-out ' +
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] ' +
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ' +
      'active:translate-y-0 ' +
      'motion-safe:hover:-translate-y-px ';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[#3395FF] text-white px-5 py-2.5 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(51,149,255,0.35)] ' +
        'hover:bg-[#1d80f0] ' +
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_rgba(51,149,255,0.45)] ' +
        'active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_8px_rgba(51,149,255,0.3)]',

      secondary:
        'bg-transparent text-[#3395FF] px-5 py-2.5 ' +
        'border border-[#3395FF40] ' +
        'shadow-[0_1px_3px_rgba(1,38,82,0.4)] ' +
        'hover:bg-[#3395FF12] hover:border-[#3395FF70] ' +
        'hover:shadow-[0_4px_16px_rgba(51,149,255,0.15)]',

      caution:
        'bg-[#F5A62320] text-[#F5A623] px-5 py-2.5 ' +
        'border border-[#F5A62340] ' +
        'shadow-[0_1px_3px_rgba(1,38,82,0.4)] ' +
        'hover:bg-[#F5A62330] hover:border-[#F5A62360] ' +
        'hover:shadow-[0_4px_16px_rgba(245,166,35,0.2)]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <>
            <span
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
              style={{ animation: 'spin-smooth 0.8s linear infinite' }}
              aria-hidden="true"
            />
            <span>Working...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
