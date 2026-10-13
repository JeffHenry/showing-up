import type { MembershipRole } from '@/context/orgContext';

/** Roles an invite can grant. Nobody is invited as an owner. */
export type InviteRole = Exclude<MembershipRole, 'owner'>;

export interface PendingInvite {
  id: string;
  role: InviteRole;
  expires_at: string;
  created_at: string;
}

/** A newly created invite. `token` is shown once and never retrievable again. */
export interface NewInvite {
  token: string;
  expiresAt: string;
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'member';

export interface InvitePreview {
  orgId: string;
  orgName: string;
  role: MembershipRole;
  status: InviteStatus;
}
