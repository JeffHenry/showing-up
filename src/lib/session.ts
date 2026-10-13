/** Supabase stores a session under `sb-<project-ref>-auth-token`. */
const SESSION_KEY = /^sb-.+-auth-token$/;

/**
 * Whether this browser has a stored sign-in session, checked synchronously, before the Supabase
 * client (which loads after first paint) can confirm it. Lets the home page show a brief loading
 * state to returning users instead of flashing the marketing page before redirecting them.
 * Storage can be unavailable (private modes, blocked cookies), so any error means "no".
 */
export function hasStoredSession(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && SESSION_KEY.test(key)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
