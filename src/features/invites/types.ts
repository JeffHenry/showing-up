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

/** A used invite, with who used it and who sent it (null when that person is no longer visible). */
export interface AcceptedInvite {
  id: string;
  role: InviteRole;
  usedAt: string;
  usedByName: string | null;
  createdByName: string | null;
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'member';

export interface InvitePreview {
  orgId: string;
  orgName: string;
  role: MembershipRole;
  status: InviteStatus;
}
