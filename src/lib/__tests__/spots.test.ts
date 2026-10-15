import { describe, expect, it } from 'vitest';
import { spotsLeft, spotsShort, spotsSummary } from '@/lib/spots';

describe('spots', () => {
  it('counts open spots, never below zero', () => {
    expect(spotsLeft(3, 8)).toBe(5);
    expect(spotsLeft(8, 8)).toBe(0);
    expect(spotsLeft(9, 8)).toBe(0);
  });

  it('labels a list item', () => {
    expect(spotsShort(3, 8)).toBe('3 of 8 filled');
    expect(spotsShort(8, 8)).toBe('Full');
  });

  it('summarizes a shift’s spots', () => {
    expect(spotsSummary(3, 8)).toBe('3 of 8 spots filled · 5 left');
    expect(spotsSummary(0, 1)).toBe('0 of 1 spot filled · 1 left');
    expect(spotsSummary(8, 8)).toBe('8 of 8 spots filled · Full');
  });
});
