import type { MembershipRole, Organization } from '@/context/orgContext';

/** An organization the signed-in user belongs to, with their role in it. */
export interface MyOrganization extends Organization {
  role: MembershipRole;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  timezone: string;
  description?: string;
  contactEmail?: string;
  websiteUrl?: string;
}
