import { createContext } from 'react';
import type { Database } from '@/types/database';

export type MembershipRole = Database['public']['Enums']['membership_role'];

export type Organization = Pick<
  Database['public']['Tables']['organizations']['Row'],
  'id' | 'name' | 'slug' | 'timezone' | 'description' | 'contact_email' | 'website_url'
>;

/** The organization in the URL (`/orgs/:orgId`) and the signed-in user's role in it. */
export interface OrgContextValue {
  org: Organization;
  role: MembershipRole;
}

export const OrgContext = createContext<OrgContextValue | null>(null);
