import type {
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
