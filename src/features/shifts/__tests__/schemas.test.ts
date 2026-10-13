import { describe, expect, it } from 'vitest';
import {
  createShiftFormSchema,
  EMPTY_SHIFT_FORM,
  shiftToFormValues,
  type ShiftFormValues,
} from '@/features/shifts/schemas';
import { overnightShift, testShift } from '@/test/fixtures/shifts';
import { wallTimeAt, zonedInstant } from '@/lib/zonedTime';

const CHICAGO = 'America/Chicago';
const schema = createShiftFormSchema(CHICAGO);

/** A date a few days from now in Chicago, so "in the future" holds whenever the tests run. */
function soon(days = 3): string {
  return wallTimeAt(new Date(Date.now() + days * 24 * 60 * 60 * 1000), CHICAGO).date;
}

function form(overrides: Partial<ShiftFormValues> = {}): ShiftFormValues {
  return {
    ...EMPTY_SHIFT_FORM,
    title: '  Morning sorting ',
    date: soon(),
    startTime: '09:00',
    endTime: '12:00',
    capacity: '6',
    ...overrides,
  };
}

/** The first message for each field, as the form shows them. */
function messages(values: ShiftFormValues) {
  const result = schema.safeParse(values);
  const firsts: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) firsts[issue.path.join('.')] ??= issue.message;
  return firsts;
}

describe('createShiftFormSchema', () => {
  it('produces a shift with UTC times and empty optional fields as null', () => {
    const values = form();

    expect(schema.parse(values)).toEqual({
      title: 'Morning sorting',
      location: null,
      description: null,
      capacity: 6,
      startTime: zonedInstant({ date: values.date, time: '09:00' }, CHICAGO)?.toISOString(),
      endTime: zonedInstant({ date: values.date, time: '12:00' }, CHICAGO)?.toISOString(),
    });
  });

  it('keeps optional details, trimmed', () => {
    expect(
      schema.parse(form({ location: ' Main warehouse ', description: ' Bring gloves. ' })),
    ).toMatchObject({ location: 'Main warehouse', description: 'Bring gloves.' });
  });

  it('explains each missing required field', () => {
    expect(messages(EMPTY_SHIFT_FORM)).toEqual({
      title: 'Enter a title, like "Morning sorting".',
      date: 'Choose a date.',
      startTime: 'Choose a start time.',
      endTime: 'Choose an end time.',
      capacity: 'Enter how many volunteers you need.',
    });
  });

  it.each([
    ['0', 'A shift needs at least 1 volunteer.'],
    ['501', 'Use 500 or fewer.'],
    ['2.5', 'Enter a whole number.'],
  ])('rejects %s volunteers', (capacity, message) => {
    expect(messages(form({ capacity }))).toEqual({ capacity: message });
  });

  it('rejects text over the database’s limits', () => {
    expect(
      messages(
        form({ title: 'x'.repeat(101), location: 'x'.repeat(201), description: 'x'.repeat(2001) }),
      ),
    ).toEqual({
      title: 'Use 100 characters or fewer.',
      location: 'Use 200 characters or fewer.',
      description: 'Use 2000 characters or fewer.',
    });
  });

  it('puts time rule messages on the field to fix', () => {
    expect(messages(form({ date: soon(-2) }))).toEqual({
      date: 'Choose a date and start time in the future.',
    });
    expect(messages(form({ date: soon(400) }))).toEqual({
      date: 'Shifts can be scheduled up to a year ahead.',
    });
  });
});

describe('shiftToFormValues', () => {
  it('shows a saved shift in the organization’s time zone, for editing or copying', () => {
    expect(shiftToFormValues(testShift, CHICAGO)).toEqual({
      title: 'Morning sorting',
      date: '2099-10-24',
      startTime: '09:00',
      endTime: '12:00',
      location: 'Main warehouse',
      capacity: '6',
      description: testShift.description,
    });
  });

  it('gives an overnight shift its start date and empty optional fields', () => {
    expect(shiftToFormValues({ ...overnightShift, location: null }, CHICAGO)).toMatchObject({
      date: '2099-10-25',
      startTime: '22:00',
      endTime: '06:00',
      location: '',
      description: '',
    });
  });
});
