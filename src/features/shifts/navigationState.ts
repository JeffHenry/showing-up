/** Navigation state telling a shift's page it was just created, so it can confirm that. */
export const SHIFT_CREATED_STATE = { shiftCreated: true } as const;

export function isShiftCreated(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'shiftCreated' in state;
}
