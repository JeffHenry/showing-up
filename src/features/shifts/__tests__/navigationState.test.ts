import { describe, expect, it } from 'vitest';
import {
  deletedShiftState,
  deletedShiftTitle,
  shiftNotice,
  shiftNoticeState,
} from '@/features/shifts/navigationState';

describe('shift notices', () => {
  it('reads back the notice a form left', () => {
    expect(shiftNotice(shiftNoticeState('created'))).toBe('created');
    expect(shiftNotice(shiftNoticeState('saved'))).toBe('saved');
  });

  it('ignores anything else in navigation state', () => {
    expect(shiftNotice(null)).toBeNull();
    expect(shiftNotice({ shiftNotice: 'hacked' })).toBeNull();
    expect(shiftNotice({ other: true })).toBeNull();
  });
});

describe('deleted shift', () => {
  it('reads back the deleted shift’s title, and nothing else', () => {
    expect(deletedShiftTitle(deletedShiftState('Food drive'))).toBe('Food drive');
    expect(deletedShiftTitle({ deletedShift: 42 })).toBeNull();
    expect(deletedShiftTitle(undefined)).toBeNull();
  });
});
