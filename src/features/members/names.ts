import type { OrgMember } from '@/features/members/types';

/** How a member is labelled everywhere in the roster. */
export function memberName(member: Pick<OrgMember, 'fullName'>): string {
  return member.fullName ?? 'Unnamed member';
}
