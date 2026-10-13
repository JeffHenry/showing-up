import { useSearchParams } from 'react-router';
import type { z } from 'zod';

type ParamValues = Record<string, string | undefined>;

/**
 * URL search params as typed values, validated by a Zod schema. Give each field a `.catch()` so a
 * hand-edited or stale URL falls back to defaults instead of breaking the page.
 *
 * Updates merge into the current params, drop empty values (keeping URLs short), and replace the
 * history entry so typing in a filter doesn't add one entry per keystroke.
 */
export function useTypedSearchParams<T extends ParamValues>(schema: z.ZodType<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const values = schema.parse(Object.fromEntries(searchParams));

  const setValues = (updates: Partial<T>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        const changes: ParamValues = updates;
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  return [values, setValues] as const;
}
