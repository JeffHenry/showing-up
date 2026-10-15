import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  availableActions,
  confirmCopy,
  needsConfirmation,
  successMessage,
} from '@/features/members/memberActions';
import { coordinatorMember, meAsOwner, volunteerMember } from '@/test/fixtures/members';

describe('availableActions', () => {
  it('offers every other role and removal for someone else', () => {
    expect(availableActions(volunteerMember, false).map(actionLabel)).toEqual([
      'Make owner',
      'Make coordinator',
      'Remove from organization',
    ]);
  });

  it('never offers removing yourself (you leave instead)', () => {
    expect(availableActions(meAsOwner, true).map(actionLabel)).toEqual([
      'Make coordinator',
      'Make volunteer',
    ]);
  });
});

describe('needsConfirmation', () => {
  it('applies a volunteer-to-coordinator promotion immediately', () => {
    expect(needsConfirmation(volunteerMember, { kind: 'role', role: 'coordinator' })).toBe(false);
  });

  it.each([
    ['making someone an owner', volunteerMember, { kind: 'role', role: 'owner' }],
    ['a demotion', coordinatorMember, { kind: 'role', role: 'volunteer' }],
    ['removal', volunteerMember, { kind: 'remove' }],
  ] as const)('asks first for %s', (_label, member, action) => {
    expect(needsConfirmation(member, action)).toBe(true);
  });
});

describe('confirmCopy', () => {
  it('names the person and the effect', () => {
    expect(confirmCopy(volunteerMember, { kind: 'remove' }, false, 'Riverside Food Bank')).toEqual({
      title: 'Remove Jordan Lee?',
      description:
        "They'll lose access to Riverside Food Bank until someone invites them again, and their upcoming shift signups there are cancelled.",
      confirmLabel: 'Remove',
      destructive: true,
    });
    expect(
      confirmCopy(coordinatorMember, { kind: 'role', role: 'owner' }, false, 'Org').title,
    ).toBe('Make Alex Kim an owner?');
    expect(
      confirmCopy(coordinatorMember, { kind: 'role', role: 'volunteer' }, false, 'Org'),
    ).toMatchObject({ title: 'Change Alex Kim to volunteer?', confirmLabel: 'Make volunteer' });
  });

  it('speaks to you when you step down', () => {
    expect(
      confirmCopy(meAsOwner, { kind: 'role', role: 'coordinator' }, true, 'Org'),
    ).toMatchObject({
      title: 'Step down to coordinator?',
      confirmLabel: 'Step down',
      destructive: true,
    });
    expect(
      confirmCopy(meAsOwner, { kind: 'role', role: 'volunteer' }, true, 'Org').description,
    ).toMatch(/see this page/);
  });
});

describe('successMessage', () => {
  it('announces the outcome with the right article', () => {
    expect(successMessage(volunteerMember, { kind: 'role', role: 'coordinator' }, false)).toBe(
      'Jordan Lee is now a coordinator.',
    );
    expect(successMessage(coordinatorMember, { kind: 'role', role: 'owner' }, false)).toBe(
      'Alex Kim is now an owner.',
    );
    expect(successMessage(meAsOwner, { kind: 'role', role: 'coordinator' }, true)).toBe(
      "You're now a coordinator.",
    );
    expect(successMessage(volunteerMember, { kind: 'remove' }, false)).toBe(
      'Jordan Lee was removed.',
    );
  });
});
