/**
 * Full-page navigation to another site (e.g. Google's sign-in page). Kept as a separate function
 * so tests can intercept it; jsdom can't navigate.
 */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
