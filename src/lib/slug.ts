export const SLUG_MAX_LENGTH = 50;

/**
 * Turns a name into a URL-safe slug: lowercase ASCII letters and digits separated by single
 * hyphens (e.g. "Café Société" → "cafe-societe"). Returns an empty string when nothing usable
 * remains, so callers can ask for one instead.
 */
export function slugify(value: string): string {
  return (
    value
      // Split accented letters into letter + accent, then drop the accents.
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .slice(0, SLUG_MAX_LENGTH)
      // Trim after cutting, so the length cap never leaves a trailing hyphen.
      .replace(/-+$/, '')
  );
}
