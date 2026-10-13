import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/dates';

describe('formatDate', () => {
  it('shows the day as it falls in the given time zone', () => {
    // 03:00 UTC on Oct 20 is still the evening of Oct 19 in Chicago.
    expect(formatDate('2026-10-20T03:00:00Z', 'America/Chicago')).toBe('Oct 19, 2026');
    expect(formatDate('2026-10-20T03:00:00Z', 'UTC')).toBe('Oct 20, 2026');
  });
});
