import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, slugify } from '@/lib/slug';

describe('slugify', () => {
  it.each([
    ['Riverside Food Bank', 'riverside-food-bank'],
    ['  Padded   name  ', 'padded-name'],
    ['Café Société', 'cafe-societe'],
    ['St. Mary’s Soup Kitchen & Pantry!', 'st-mary-s-soup-kitchen-pantry'],
    ['Room 101', 'room-101'],
    ['--Already-Slugged--', 'already-slugged'],
  ])('turns %j into %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} bcd`);

    expect(slug).toBe('a'.repeat(SLUG_MAX_LENGTH - 1));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });
});
