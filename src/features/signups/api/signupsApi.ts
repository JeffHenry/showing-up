import type { ShiftSignup } from '@/features/signups/types';
import { supabase } from '@/lib/supabase';

/**
 * Signs the signed-in person up. The database locks the shift, so two people can't take the
 * last spot, and refuses full, cancelled, started, or overlapping shifts (see `claim_shift`).
 */
export async function claimShift(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_shift', { p_shift_id: shiftId });
  if (error) throw error;
}

/**
 * Drops a signup before the shift starts: the signed-in person's own, or (coordinators and
 * owners) someone else's when `userId` is given (see `cancel_signup`).
 */
export async function cancelSignup({
  shiftId,
  userId,
}: {
  shiftId: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('cancel_signup', {
    p_shift_id: shiftId,
    p_user_id: userId,
  });
  if (error) throw error;
}

/**
 * Who's coming to a shift, earliest signup first. Coordinators and owners see everyone
 * (row-level security shows volunteers only their own signup, so they never call this).
 */
export async function fetchShiftSignups(shiftId: string): Promise<ShiftSignup[]> {
  const { data, error } = await supabase
    .from('signups')
    .select('user_id, updated_at, profile:profiles!signups_user_id_fkey(full_name)')
    .eq('shift_id', shiftId)
    .eq('status', 'confirmed')
    .order('updated_at');
  if (error) throw error;
  return data.map((row) => {
    // Typed as always present (the foreign key is required), but row-level security hides the
    // profile of anyone who no longer shares an organization with the viewer.
    const profile = row.profile as { full_name: string | null } | null;
    return {
      userId: row.user_id,
      fullName: profile?.full_name ?? null,
      signedUpAt: row.updated_at,
    };
  });
}
