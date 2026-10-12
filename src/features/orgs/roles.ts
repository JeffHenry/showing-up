import type { MembershipRole } from '@/context/orgContext';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: 'Owner',
  coordinator: 'Coordinator',
  volunteer: 'Volunteer',
};
