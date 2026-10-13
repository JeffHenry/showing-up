/** What a shift's page confirms on arrival, after the form that led there saved. */
export type ShiftNotice = 'created' | 'saved';

export const SHIFT_NOTICES: Record<ShiftNotice, string> = {
  created: 'Shift created.',
  saved: 'Changes saved.',
};

export function shiftNoticeState(notice: ShiftNotice) {
  return { shiftNotice: notice };
}

export function shiftNotice(state: unknown): ShiftNotice | null {
  if (typeof state !== 'object' || state === null || !('shiftNotice' in state)) return null;
  const { shiftNotice: notice } = state;
  return notice === 'created' || notice === 'saved' ? notice : null;
}

/** Tells the shift list which shift was just deleted, so it can confirm that. */
export function deletedShiftState(title: string) {
  return { deletedShift: title };
}

export function deletedShiftTitle(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('deletedShift' in state)) return null;
  return typeof state.deletedShift === 'string' ? state.deletedShift : null;
}
