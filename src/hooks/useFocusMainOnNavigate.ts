import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Moves focus to the returned element after client-side navigation, so keyboard and
 * screen-reader users start at the new page's content instead of wherever they clicked.
 * Skips the first render (the browser handles initial page load) and ignores search-param
 * changes such as filters, which shouldn't steal focus.
 */
export function useFocusMainOnNavigate<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    ref.current?.focus();
  }, [pathname]);

  return ref;
}
