import { Ban, Clock } from 'lucide-react';
import type { ShiftStatus } from '@/features/shifts/types';

const BADGES = {
  cancelled: { icon: Ban, label: 'Cancelled', className: 'border-destructive/30 text-destructive' },
  'in-progress': { icon: Clock, label: 'In progress', className: 'border-primary/30 text-primary' },
} as const;

/** Marks cancelled and in-progress shifts with an icon and text, never color alone. */
export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  if (status !== 'cancelled' && status !== 'in-progress') return null;
  const { icon: Icon, label, className } = BADGES[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}
