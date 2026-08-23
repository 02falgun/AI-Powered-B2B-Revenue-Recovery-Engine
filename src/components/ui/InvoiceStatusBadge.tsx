'use client';

export type InvoiceStatus = 'overdue' | 'paid' | 'partially_paid' | 'in_recovery' | 'human_review';

interface InvoiceStatusBadgeProps {
  readonly status: InvoiceStatus | string;
  readonly className?: string;
}

/**
 * InvoiceStatusBadge — Color-Free Status Indicator.
 * Differentiated by shape, weight, border style, and iconography.
 */
export function InvoiceStatusBadge({ status, className = '' }: InvoiceStatusBadgeProps) {
  const normalized = status.toLowerCase();

  type BadgeConfig = {
    label: string;
    icon: string;
    styles: string;
  };

  const configs: Record<string, BadgeConfig> = {
    overdue: {
      label: 'OVERDUE',
      icon: '⏱',
      styles:
        'bg-[#1C1C20] text-[#FAFAFA] border border-[#52525B] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.6)] font-semibold',
    },
    paid: {
      label: 'SETTLED',
      icon: '✓',
      styles:
        'bg-[#FAFAFA] text-[#0D0D0E] border border-[#FFFFFF] ' +
        'shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-bold',
    },
    partially_paid: {
      label: 'PARTIALLY PAID',
      icon: '◐',
      styles:
        'bg-[#202024] text-[#E4E4E7] border border-[#3F3F46] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] font-medium',
    },
    in_recovery: {
      label: 'IN RECOVERY',
      icon: '⟳',
      styles:
        'bg-[#141416] text-[#A1A1AA] border border-dashed border-[#52525B] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-medium',
    },
    human_review: {
      label: 'REVIEW REQUIRED',
      icon: '▲',
      styles:
        'bg-[#18181B] text-[#FAFAFA] border-2 border-[#71717A] ' +
        'shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.1)] font-bold',
    },
  };

  const config = configs[normalized] ?? {
    label: status.toUpperCase(),
    icon: '●',
    styles: 'bg-[#18181B] text-[#A1A1AA] border border-[#3F3F46]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs uppercase tracking-wider rounded-sm select-none ${config.styles} ${className}`}
    >
      <span className="text-[11px] leading-none" aria-hidden="true">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </span>
  );
}
