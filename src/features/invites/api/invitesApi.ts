import type {
  AcceptedInvite,
  InvitePreview,
  InviteRole,
  InviteStatus,
  NewInvite,
  PendingInvite,
} from '@/features/invites/types';
import { supabase } from '@/lib/supabase';

const INVITE_STATUSES: readonly string[] = ['valid', 'expired', 'used', 'member'];

function isInviteStatus(status: string): status is InviteStatus {
  return INVITE_STATUSES.includes(status);
}

function isInviteRole(role: string): role is InviteRole {
  return role === 'coordinator' || role === 'volunteer';
}

/** The link an invitee opens. Tokens are URL-safe, so they need no encoding. */
export function inviteUrl(token: string): string {
  return new URL(`/invite/${token}`, window.location.origin).toString();
}

/** Creates a single-use invite; the database generates the token and returns it only now. */
export async function createInvite({
  orgId,
  role,
}: {
  orgId: string;
  role: InviteRole;
}): Promise<NewInvite> {
  const { data, error } = await supabase.rpc('create_invite', { p_org_id: orgId, p_role: role });
  if (error) throw error;
  const [invite] = data;
  if (!invite) throw new Error('create_invite returned no invite.');
  return { token: invite.token, expiresAt: invite.expires_at };
}

/** Invites that can still be used, soonest to expire first. */
export async function fetchPendingInvites(orgId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, role, expires_at, created_at')
    .eq('org_id', orgId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at');
  if (error) throw error;
  return data.flatMap((invite) => {
    const { role } = invite;
    return isInviteRole(role) ? [{ ...invite, role }] : [];
  });
}

/** How far back "Recently accepted" looks. */
const ACCEPTED_WINDOW_DAYS = 30;

/**
 * Invites used in the last 30 days, newest first, with the names of who used and who sent them.
 * A name is null when that person has left and no longer shares an organization with the viewer.
 */
export async function fetchAcceptedInvites(orgId: string): Promise<AcceptedInvite[]> {
  const since = new Date(Date.now() - ACCEPTED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('invites')
    .select(
      'id, role, used_at, used_by:profiles!invites_used_by_fkey(full_name), created_by:profiles!invites_created_by_fkey(full_name)',
    )
    .eq('org_id', orgId)
    .not('used_at', 'is', null)
    .gte('used_at', since.toISOString())
    .order('used_at', { ascending: false });
  if (error) throw error;
  return data.flatMap(({ id, role, used_at: usedAt, used_by: usedBy, created_by: createdBy }) =>
    isInviteRole(role) && usedAt
      ? [
          {
            id,
            role,
            usedAt,
            usedByName: usedBy?.full_name ?? null,
            createdByName: createdBy?.full_name ?? null,
          },
        ]
      : [],
  );
}

/** Revoking deletes the invite, so its link stops working. */
export async function revokeInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

/** What an invite link leads to, for the signed-in person who opened it. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('get_invite', { p_token: token });
  if (error) throw error;
  const [invite] = data;
  if (!invite || !isInviteStatus(invite.status)) {
    throw new Error('get_invite returned an unexpected result.');
  }
  return {
    orgId: invite.org_id,
    orgName: invite.org_name,
    role: invite.role,
    status: invite.status,
  };
}

/** Joins the invite's organization and returns its id. */
export async function redeemInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token });
  if (error) throw error;
  return data;
}
