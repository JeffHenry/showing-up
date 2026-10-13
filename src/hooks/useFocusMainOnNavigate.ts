import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Moves focus to the returned element after client-side navigation, so keyboard and
 * screen-reader users start at the new page's content instead of wherever they clicked.
 * Skips the first render (the browser handles initial page load) and ignores search-param
 * changes such as filters, which shouldn't steal focus. Links to a section (`/page#section`)
 * are left to the page, which focuses that section instead.
 */
export function useFocusMainOnNavigate<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { pathname, hash } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // Scroll position is ScrollRestoration's job (top of the new page). A plain focus() would
    // also scroll the main region to the top of the window, hiding the header on long pages.
    if (!hash) ref.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return ref;
}
