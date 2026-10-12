import type { CreateOrganizationInput, MyOrganization } from '@/features/orgs/types';
import { supabase } from '@/lib/supabase';

/**
 * The signed-in user's organizations, by name, with their role in each. Row-level security
 * already limits the rows to organizations they belong to; the inner join on memberships picks
 * out their own membership (and so their role) from each roster.
 */
export async function fetchMyOrganizations(userId: string): Promise<MyOrganization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, timezone, description, contact_email, website_url, memberships!inner(role)',
    )
    .eq('memberships.user_id', userId)
    .order('name');
  if (error) throw error;

  return data.flatMap(({ memberships, ...org }) => {
    const role = memberships[0]?.role;
    return role ? [{ ...org, role }] : [];
  });
}

/** Creates an organization owned by the signed-in user (see `create_organization` in the DB). */
export async function createOrganization(input: CreateOrganizationInput) {
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: input.name,
    p_slug: input.slug,
    p_timezone: input.timezone,
    // Optional details are left out of the request when blank.
    p_description: input.description,
    p_contact_email: input.contactEmail,
    p_website_url: input.websiteUrl,
  });
  if (error) throw error;
  return data;
}
