/** How many spots on a shift are still open. */
export function spotsLeft(filled: number, capacity: number): number {
  return Math.max(capacity - filled, 0);
}

/** "3 of 8 filled", or "Full" (for lists). */
export function spotsShort(filled: number, capacity: number): string {
  return spotsLeft(filled, capacity) === 0
    ? 'Full'
    : `${String(filled)} of ${String(capacity)} filled`;
}

/** "3 of 8 spots filled · 5 left", or "8 of 8 spots filled · Full" (for a shift's page). */
export function spotsSummary(filled: number, capacity: number): string {
  const left = spotsLeft(filled, capacity);
  const filledText = `${String(filled)} of ${String(capacity)} ${capacity === 1 ? 'spot' : 'spots'} filled`;
  return `${filledText} · ${left === 0 ? 'Full' : `${String(left)} left`}`;
}
