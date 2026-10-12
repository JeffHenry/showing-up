import type { Organization } from '@/context/orgContext';
import type { MyOrganization } from '@/features/orgs/types';

export const testOrg: MyOrganization = {
  id: '00000000-0000-0000-0000-0000000000b1',
  name: 'Riverside Food Bank',
  slug: 'riverside-food-bank',
  timezone: 'America/Chicago',
  description: 'Feeding families since 1998.',
  contact_email: 'hello@riverside.example',
  website_url: 'https://www.riverside.example/about',
  role: 'owner',
};

export const otherTestOrg: MyOrganization = {
  id: '00000000-0000-0000-0000-0000000000b2',
  name: 'Eastside Pantry',
  slug: 'eastside-pantry',
  timezone: 'America/New_York',
  description: null,
  contact_email: null,
  website_url: null,
  role: 'volunteer',
};

/** The organization itself, without the user's role (as the database's `organizations` row). */
export function organizationOf(org: MyOrganization): Organization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    timezone: org.timezone,
    description: org.description,
    contact_email: org.contact_email,
    website_url: org.website_url,
  };
}
