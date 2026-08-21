'use client';

export type InvoiceStatus = 'overdue' | 'paid' | 'partially_paid' | 'in_recovery' | 'human_review';

interface InvoiceStatusBadgeProps {
  readonly status: InvoiceStatus | string;
  readonly className?: string;
}

export function InvoiceStatusBadge({ status, className = '' }: InvoiceStatusBadgeProps) {
  const normalized = status.toLowerCase();

  let styleClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let label = status;

  switch (normalized) {
    case 'overdue':
      styleClasses = 'bg-red-500/10 text-red-400 border-red-500/30';
      label = 'Overdue';
      break;
    case 'paid':
      styleClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      label = 'Paid in Full';
      break;
    case 'partially_paid':
      styleClasses = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      label = 'Partially Paid';
      break;
    case 'in_recovery':
      styleClasses = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      label = 'In Recovery';
      break;
    case 'human_review':
      styleClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      label = 'Human Review Required';
      break;
    default:
      label = status;
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleClasses} ${className}`}
    >
      {label}
    </span>
  );
}
