'use client';

export type InvoiceStatus = 'overdue' | 'paid' | 'partially_paid' | 'in_recovery' | 'human_review';

interface InvoiceStatusBadgeProps {
  readonly status: InvoiceStatus | string;
  readonly className?: string;
}

/**
 * InvoiceStatusBadge — elevated pill with bevel highlight.
 * Color map uses RecoverAI design tokens, not raw Tailwind defaults.
 */
export function InvoiceStatusBadge({ status, className = '' }: InvoiceStatusBadgeProps) {
  const normalized = status.toLowerCase();

  type BadgeConfig = {
    label: string;
    dot: string;
    styles: string;
  };

  const configs: Record<string, BadgeConfig> = {
    overdue: {
      label: 'Overdue',
      dot: 'bg-[#F04E37]',
      styles:
        'bg-[#F04E3715] text-[#F04E37] border-[#F04E3740] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_8px_rgba(240,78,55,0.15)]',
    },
    paid: {
      label: 'Paid in Full',
      dot: 'bg-[#00C48C]',
      styles:
        'bg-[#00C48C15] text-[#00C48C] border-[#00C48C40] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_8px_rgba(0,196,140,0.15)]',
    },
    partially_paid: {
      label: 'Partially Paid',
      dot: 'bg-[#3395FF]',
      styles:
        'bg-[#3395FF15] text-[#3395FF] border-[#3395FF40] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_8px_rgba(51,149,255,0.15)]',
    },
    in_recovery: {
      label: 'In Recovery',
      dot: 'bg-[#7EC8E3]',
      styles:
        'bg-[#7EC8E315] text-[#7EC8E3] border-[#7EC8E340] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    },
    human_review: {
      label: 'Human Review',
      dot: 'bg-[#F5A623]',
      styles:
        'bg-[#F5A62315] text-[#F5A623] border-[#F5A62340] ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_8px_rgba(245,166,35,0.15)]',
    },
  };

  const config = configs[normalized] ?? {
    label: status,
    dot: 'bg-[#1A2F55]',
    styles: 'bg-[#0C1A35] text-[#7EC8E3] border-[#1A2F55]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-display border ${config.styles} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
