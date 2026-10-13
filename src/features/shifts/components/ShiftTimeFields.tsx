import { useState } from 'react';
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/input';
import type { ShiftFormValues } from '@/features/shifts/schemas';
import { latestStart, overnightEnd } from '@/features/shifts/shiftTimes';
import type { ShiftInput } from '@/features/shifts/types';
import { formatShortDate, formatTime, timeZoneGenericName } from '@/lib/dates';
import { timeZoneLabel } from '@/lib/timezones';
import { wallTimeAt } from '@/lib/zonedTime';

interface ShiftTimeFieldsProps {
  timeZone: string;
  register: UseFormRegister<ShiftFormValues>;
  control: Control<ShiftFormValues, unknown, ShiftInput>;
  errors: FieldErrors<ShiftFormValues>;
}

/**
 * Date, start time, and end time, entered in the organization's time zone whatever the device's
 * own is. An end time at or before the start time means the shift runs overnight, and the hint
 * spells out when it ends.
 */
export function ShiftTimeFields({ timeZone, register, control, errors }: ShiftTimeFieldsProps) {
  const [date, startTime, endTime] = useWatch({ control, name: ['date', 'startTime', 'endTime'] });
  // The date picker offers today through a year from now (the form re-checks on submit).
  const [range] = useState(() => {
    const now = new Date();
    return {
      min: wallTimeAt(now, timeZone).date,
      max: wallTimeAt(latestStart(now), timeZone).date,
    };
  });

  const end = overnightEnd({ date, startTime, endTime }, timeZone);
  const endHint = end
    ? `Ends ${formatShortDate(end.toISOString(), timeZone)} at ${formatTime(end.toISOString(), timeZone)} (next day).`
    : 'If it’s at or before the start time, the shift ends the next day.';

  return (
    <fieldset aria-describedby="shift-time-zone" className="space-y-4">
      <legend className="float-left mb-1 w-full font-medium">When</legend>
      <p id="shift-time-zone" className="clear-left text-sm text-muted-foreground">
        Times are in {timeZoneGenericName(timeZone)} ({timeZoneLabel(timeZone)}).
      </p>
      <FormField id="shift-date" label="Date" error={errors.date?.message}>
        {(field) => (
          <Input
            {...field}
            type="date"
            min={range.min}
            max={range.max}
            className="w-auto"
            {...register('date')}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="shift-start-time" label="Start time" error={errors.startTime?.message}>
          {(field) => (
            <Input {...field} type="time" className="w-auto" {...register('startTime')} />
          )}
        </FormField>
        <FormField
          id="shift-end-time"
          label="End time"
          hint={endHint}
          error={errors.endTime?.message}
        >
          {(field) => <Input {...field} type="time" className="w-auto" {...register('endTime')} />}
        </FormField>
      </div>
    </fieldset>
  );
}
