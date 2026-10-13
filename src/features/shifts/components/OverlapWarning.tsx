import { TriangleAlert } from 'lucide-react';
import { useWatch, type Control } from 'react-hook-form';
import { useOverlappingShifts } from '@/features/shifts/api/useShiftQueries';
import type { ShiftFormValues } from '@/features/shifts/schemas';
import { shiftInterval } from '@/features/shifts/shiftTimes';
import type { ShiftInput } from '@/features/shifts/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatShortDate, formatTimeRange } from '@/lib/dates';

/** How long typing must pause before the form checks for overlaps. */
const CHECK_DELAY_MS = 400;

interface OverlapWarningProps {
  orgId: string;
  timeZone: string;
  control: Control<ShiftFormValues, unknown, ShiftInput>;
  /** The shift being edited, which never overlaps itself. */
  excludeShiftId: string | null;
}

/**
 * Warns, without blocking, when the shift being entered overlaps another one at the same
 * location (or, without a location, one with the same title): usually an accidental duplicate,
 * sometimes a parallel crew. Announced politely as it appears.
 */
export function OverlapWarning({ orgId, timeZone, control, excludeShiftId }: OverlapWarningProps) {
  const [title, date, startTime, endTime, location] = useWatch({
    control,
    name: ['title', 'date', 'startTime', 'endTime', 'location'],
  });
  const interval = shiftInterval({ date, startTime, endTime }, timeZone);

  // Debounced one by one: each is a plain string, so it settles once typing stops.
  const start = useDebouncedValue(interval.ok ? interval.start.toISOString() : '', CHECK_DELAY_MS);
  const end = useDebouncedValue(interval.ok ? interval.end.toISOString() : '', CHECK_DELAY_MS);
  const place = useDebouncedValue(location.trim(), CHECK_DELAY_MS);
  const name = useDebouncedValue(title.trim(), CHECK_DELAY_MS);

  const overlapWindow =
    start && end && (place || name)
      ? { start, end, location: place || null, title: name, excludeShiftId }
      : null;
  const { data } = useOverlappingShifts(orgId, overlapWindow);
  const overlaps = overlapWindow ? (data ?? []) : [];

  const what = overlaps.length === 1 ? 'another shift' : 'other shifts';
  const heading = place
    ? `This overlaps ${what} at ${place}:`
    : `This overlaps ${what} called “${name}”:`;

  return (
    <div role="status">
      {overlaps.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-700" />
            {heading}
          </p>
          <ul className="list-disc space-y-1 pl-6">
            {overlaps.map((shift) => (
              <li key={shift.id}>
                {shift.title}, {formatShortDate(shift.start_time, timeZone)},{' '}
                {formatTimeRange(shift.start_time, shift.end_time, timeZone)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            You can still save it, for example for a second crew.
          </p>
        </div>
      )}
    </div>
  );
}
