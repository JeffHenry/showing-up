import { Ban } from 'lucide-react';
import type { ShiftDetail } from '@/features/shifts/types';
import { formatDayHeading, formatTimeRange, timeZoneAbbreviation } from '@/lib/dates';

interface ShiftDetailsProps {
  shift: ShiftDetail;
  timeZone: string;
  now: Date;
}

/** A shift's own information: whether it's cancelled, when and where it is, and its details. */
export function ShiftDetails({ shift, timeZone, now }: ShiftDetailsProps) {
  const when = `${formatDayHeading(shift.start_time, timeZone, now)}, ${formatTimeRange(
    shift.start_time,
    shift.end_time,
    timeZone,
  )} ${timeZoneAbbreviation(shift.start_time, timeZone)}`;

  return (
    <>
      {shift.cancelled_at && (
        <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Ban aria-hidden="true" className="size-4 text-destructive" />
            This shift was cancelled.
          </p>
          {shift.cancel_reason && (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {shift.cancel_reason}
            </p>
          )}
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-[auto_1fr]">
        <dt className="text-sm text-muted-foreground">When</dt>
        <dd>{when}</dd>
        <dt className="text-sm text-muted-foreground">Where</dt>
        <dd>{shift.location ?? 'No location given'}</dd>
      </dl>
      {shift.description && (
        <section aria-labelledby="shift-details-heading" className="space-y-2">
          <h2 id="shift-details-heading" className="text-lg font-medium">
            Details
          </h2>
          {/* Plain text with the line breaks the coordinator typed; never parsed as HTML. */}
          <p className="whitespace-pre-line">{shift.description}</p>
        </section>
      )}
    </>
  );
}
