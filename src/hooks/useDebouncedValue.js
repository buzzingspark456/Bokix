import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates once `delayMs`
 * has passed without `value` changing again. Uses a cleanup-safe timeout
 * (each render cancels the previous timer) so a stale, slower update can
 * never land after — and overwrite — a newer one.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
