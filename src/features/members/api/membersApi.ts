import type { MembershipRole } from '@/context/orgContext';
import type { OrgMember } from '@/features/members/types';
import { supabase } from '@/lib/supabase';

/**
 * Row-level security doesn't raise an error when it filters out an update or delete: the
 * statement simply affects no rows. Treat that as "not allowed" so the UI never reports a change
 * that didn't happen (`toAppError` maps 42501 to NOT_AUTHORIZED).
 */
function assertChanged(rows: unknown[]) {
  if (rows.length === 0) {
    throw Object.assign(new Error('No membership was changed.'), { code: '42501' });
  }
}

/** The roster, with emails: coordinators and owners only (see `list_org_members`). */
export async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('list_org_members', { p_org_id: orgId });
  if (error) throw error;
  return data.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

/** Owners only. The database refuses to leave an organization without an owner (LAST_OWNER). */
export async function changeMemberRole({
  orgId,
  userId,
  role,
}: {
  orgId: string;
  userId: string;
  role: MembershipRole;
}) {
  const { data, error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  assertChanged(data);
}

/** Owners can remove anyone; everyone can remove themselves (leave). */
export async function removeMembership({ orgId, userId }: { orgId: string; userId: string }) {
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  assertChanged(data);
}
