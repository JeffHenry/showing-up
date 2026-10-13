import { ShiftListItem } from '@/features/shifts/components/ShiftListItem';
import type { ShiftDay } from '@/features/shifts/display';
import { formatDayHeading } from '@/lib/dates';

interface ShiftDayGroupProps {
  day: ShiftDay;
  orgId: string;
  timeZone: string;
  now: Date;
}

/** One day's shifts under a heading such as "Saturday, October 24". */
export function ShiftDayGroup({ day, orgId, timeZone, now }: ShiftDayGroupProps) {
  const headingId = `shift-day-${day.key}`;
  const [first] = day.shifts;
  if (!first) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
        {formatDayHeading(first.start_time, timeZone, now)}
      </h2>
      <ul className="space-y-3">
        {day.shifts.map((shift) => (
          <ShiftListItem key={shift.id} shift={shift} orgId={orgId} timeZone={timeZone} now={now} />
        ))}
      </ul>
    </section>
  );
}
