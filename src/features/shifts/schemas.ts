import { z } from 'zod';
import { resolveShiftTimes } from '@/features/shifts/shiftTimes';
import type { ShiftDetail, ShiftInput } from '@/features/shifts/types';
import { wallTimeAt } from '@/lib/zonedTime';

// Limits match the database's CHECK constraints (see the shifts migration).
export const TITLE_MAX_LENGTH = 100;
export const LOCATION_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const CAPACITY_MAX = 500;

const fieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a title, like "Morning sorting".')
    .max(TITLE_MAX_LENGTH, `Use ${String(TITLE_MAX_LENGTH)} characters or fewer.`),
  date: z
    .string()
    .min(1, 'Choose a date.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date like 2026-10-24.'),
  startTime: z
    .string()
    .min(1, 'Choose a start time.')
    .regex(/^\d{2}:\d{2}$/, 'Enter a time like 09:30.'),
  endTime: z
    .string()
    .min(1, 'Choose an end time.')
    .regex(/^\d{2}:\d{2}$/, 'Enter a time like 17:00.'),
  location: z
    .string()
    .trim()
    .max(LOCATION_MAX_LENGTH, `Use ${String(LOCATION_MAX_LENGTH)} characters or fewer.`),
  capacity: z
    .string()
    .trim()
    .min(1, 'Enter how many volunteers you need.')
    .regex(/^\d+$/, 'Enter a whole number.')
    .transform(Number)
    .pipe(
      z
        .number()
        .min(1, 'A shift needs at least 1 volunteer.')
        .max(CAPACITY_MAX, `Use ${String(CAPACITY_MAX)} or fewer.`),
    ),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, `Use ${String(DESCRIPTION_MAX_LENGTH)} characters or fewer.`),
});

export type ShiftFormValues = z.input<typeof fieldsSchema>;

export const EMPTY_SHIFT_FORM: ShiftFormValues = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  capacity: '',
  description: '',
};

/** A saved shift as form values, in the organization's time zone (to edit or duplicate it). */
export function shiftToFormValues(shift: ShiftDetail, timeZone: string): ShiftFormValues {
  const start = wallTimeAt(shift.start_time, timeZone);
  return {
    title: shift.title,
    date: start.date,
    startTime: start.time,
    endTime: wallTimeAt(shift.end_time, timeZone).time,
    location: shift.location ?? '',
    capacity: String(shift.capacity),
    description: shift.description ?? '',
  };
}

/**
 * The shift form's rules. Dates and times are entered in the organization's time zone and come
 * out as UTC instants; "now" is read at validation time, so a form left open stays accurate.
 */
export function createShiftFormSchema(timeZone: string): z.ZodType<ShiftInput, ShiftFormValues> {
  return fieldsSchema.transform((values, ctx) => {
    const times = resolveShiftTimes(values, timeZone, new Date());
    if (!times.ok) {
      ctx.issues.push({
        code: 'custom',
        message: times.message,
        path: [times.field],
        input: values,
      });
      return z.NEVER;
    }
    return {
      title: values.title,
      // Blank optional fields are stored as empty (null), not as empty strings.
      location: values.location || null,
      description: values.description || null,
      startTime: times.start.toISOString(),
      endTime: times.end.toISOString(),
      capacity: values.capacity,
    };
  });
}
