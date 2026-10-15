import { CircleCheck, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ShiftStatusBadge } from '@/features/shifts/components/ShiftStatusBadge';
import { shiftLinkId, shiftStatus } from '@/features/shifts/display';
import type { ShiftSummary } from '@/features/shifts/types';
import { formatTimeRange } from '@/lib/dates';
import { spotsShort } from '@/lib/spots';

interface ShiftListItemProps {
  shift: ShiftSummary;
  orgId: string;
  timeZone: string;
  now: Date;
}

/**
 * One shift as a card. The title is the link, stretched over the whole card so the card is one
 * click target while the link's name stays short for screen readers.
 */
export function ShiftListItem({ shift, orgId, timeZone, now }: ShiftListItemProps) {
  const status = shiftStatus(shift, now);

  return (
    <li className="relative space-y-1 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">
          <Link
            id={shiftLinkId(shift.id)}
            to={`/orgs/${orgId}/shifts/${shift.id}`}
            className="outline-none after:absolute after:inset-0"
          >
            {shift.title}
          </Link>
        </h3>
        <div className="flex flex-wrap justify-end gap-2">
          {shift.signed_up && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
              <CircleCheck aria-hidden="true" className="size-3" />
              You’re signed up
            </span>
          )}
          <ShiftStatusBadge status={status} />
        </div>
      </div>
      <p className="text-sm">{formatTimeRange(shift.start_time, shift.end_time, timeZone)}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {shift.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden="true" className="size-4" />
            {shift.location}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden="true" className="size-4" />
          {spotsShort(shift.confirmed_count, shift.capacity)}
        </span>
      </div>
    </li>
  );
}
