'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'caution';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
  readonly children: React.ReactNode;
}

/**
 * PrimaryButton — Tactile Mechanical Button (Grayscale Control Center).
 * Provides a 2px physical press down with shadow compression.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(
    { variant = 'primary', isLoading = false, className = '', children, disabled, ...rest },
    ref,
  ) {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg font-bold text-sm select-none ' +
      'transition-all duration-75 ease-out ' +
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAFAFA] ' +
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[#FAFAFA] text-[#0D0D0E] border border-[#FFFFFF] px-5 py-2.5 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_3px_0_#202024,0_4px_6px_rgba(0,0,0,0.6)] ' +
        'hover:bg-[#E4E4E7] ' +
        'active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_0_#202024,0_2px_3px_rgba(0,0,0,0.8)]',

      secondary:
        'bg-[#202024] text-[#FAFAFA] border border-[#383840] px-5 py-2.5 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_#000000,0_3px_6px_rgba(0,0,0,0.5)] ' +
        'hover:bg-[#2A2A30] hover:border-[#52525B] ' +
        'active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_#000000,0_1px_2px_rgba(0,0,0,0.8)]',

      caution:
        'bg-[#18181B] text-[#FAFAFA] border-2 border-[#71717A] px-5 py-2.5 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_0_#000000,0_3px_6px_rgba(0,0,0,0.6)] ' +
        'hover:bg-[#202024] hover:border-[#A1A1AA] ' +
        'active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]',
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
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span>Processing...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
