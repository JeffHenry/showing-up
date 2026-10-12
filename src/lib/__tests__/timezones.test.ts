import { describe, expect, it, vi } from 'vitest';
import { browserTimeZone, timeZoneLabel, timeZoneOptions } from '@/lib/timezones';

describe('timeZoneOptions', () => {
  it('lists IANA zones in order, including UTC', () => {
    const zones = timeZoneOptions();

    expect(zones).toContain('UTC');
    expect(zones).toContain('America/Chicago');
    expect(zones).toEqual([...zones].sort((a, b) => a.localeCompare(b)));
  });

  it("includes the browser's zone even when the list leaves it out", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Asia/Calcutta',
    });

    expect(browserTimeZone()).toBe('Asia/Calcutta');
    expect(timeZoneOptions()).toContain('Asia/Calcutta');
  });
});

describe('timeZoneLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(timeZoneLabel('America/Los_Angeles')).toBe('America/Los Angeles');
  });
});
