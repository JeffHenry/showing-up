import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delayMs`. Use it to wait until someone pauses
 * typing before asking the server about what they typed.
 *
 * Primitives only: an object rebuilt on every render never "stops changing".
 */
export function useDebouncedValue<T extends string | number | boolean | null>(
  value: T,
  delayMs: number,
): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
