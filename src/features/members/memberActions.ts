import type { MembershipRole } from '@/context/orgContext';
import { memberName } from '@/features/members/names';
import type { OrgMember } from '@/features/members/types';
import { ROLE_LABELS } from '@/lib/roles';

export type MemberAction = { kind: 'role'; role: MembershipRole } | { kind: 'remove' };

const ROLE_RANK: Record<MembershipRole, number> = { owner: 0, coordinator: 1, volunteer: 2 };
const ROLES: readonly MembershipRole[] = ['owner', 'coordinator', 'volunteer'];

function withArticle(role: MembershipRole): string {
  const label = ROLE_LABELS[role].toLowerCase();
  return role === 'owner' ? `an ${label}` : `a ${label}`;
}

/** What an owner can do to a member: every other role, and removal (not for themselves: they leave). */
export function availableActions(member: OrgMember, isYou: boolean): MemberAction[] {
  const roleChanges = ROLES.filter((role) => role !== member.role).map((role): MemberAction => ({
    kind: 'role',
    role,
  }));
  return isYou ? roleChanges : [...roleChanges, { kind: 'remove' }];
}

/** Everything asks first except promoting a volunteer to coordinator, which only adds access. */
export function needsConfirmation(member: OrgMember, action: MemberAction): boolean {
  return !(action.kind === 'role' && member.role === 'volunteer' && action.role === 'coordinator');
}

export function actionLabel(action: MemberAction): string {
  return action.kind === 'remove'
    ? 'Remove from organization'
    : `Make ${ROLE_LABELS[action.role].toLowerCase()}`;
}

export interface ConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
}

/** The confirmation dialog's wording: who, and what they (or you) will gain or lose. */
export function confirmCopy(
  member: OrgMember,
  action: MemberAction,
  isYou: boolean,
  orgName: string,
): ConfirmCopy {
  const name = memberName(member);

  if (action.kind === 'remove') {
    return {
      title: `Remove ${name}?`,
      description: `They'll lose access to ${orgName} until someone invites them again, and their upcoming shift signups there are cancelled.`,
      confirmLabel: 'Remove',
      destructive: true,
    };
  }

  const label = ROLE_LABELS[action.role].toLowerCase();
  if (action.role === 'owner') {
    return {
      title: `Make ${name} an owner?`,
      description: "Owners can change anyone's role, remove members, and make other owners.",
      confirmLabel: 'Make owner',
      destructive: false,
    };
  }

  const losesManagement = member.role === 'owner';
  if (isYou) {
    return {
      title: `Step down to ${label}?`,
      description:
        action.role === 'volunteer'
          ? "You'll no longer be able to manage members, invite people, or see this page."
          : "You'll no longer be able to change roles or remove members. Another owner can change this back.",
      confirmLabel: 'Step down',
      destructive: true,
    };
  }

  return {
    title: `Change ${name} to ${label}?`,
    description: losesManagement
      ? "They'll no longer be able to change roles or remove members."
      : "They'll no longer be able to invite people or see the member list.",
    confirmLabel: `Make ${label}`,
    destructive: ROLE_RANK[action.role] > ROLE_RANK[member.role],
  };
}

/** Announced after the change succeeds. */
export function successMessage(member: OrgMember, action: MemberAction, isYou: boolean): string {
  if (action.kind === 'remove') return `${memberName(member)} was removed.`;
  return isYou
    ? `You're now ${withArticle(action.role)}.`
    : `${memberName(member)} is now ${withArticle(action.role)}.`;
}
