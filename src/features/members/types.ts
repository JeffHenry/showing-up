import type { MembershipRole } from '@/context/orgContext';

export interface OrgMember {
  userId: string;
  /** Null for members who haven't chosen a name (rare: names are asked for at sign-in). */
  fullName: string | null;
  email: string;
  role: MembershipRole;
  joinedAt: string;
}
