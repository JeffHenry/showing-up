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
