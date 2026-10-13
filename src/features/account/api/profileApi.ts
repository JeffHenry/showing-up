import { supabase } from '@/lib/supabase';

export interface MyProfile {
  id: string;
  /** Null until the person chooses a name (email sign-ups start without one). */
  full_name: string | null;
}

export async function fetchMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/** Sets the signed-in person's display name; row-level security only allows their own row. */
export async function updateMyName({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: name })
    .eq('id', userId)
    .select('id, full_name')
    .single();
  if (error) throw error;
  return data;
}
