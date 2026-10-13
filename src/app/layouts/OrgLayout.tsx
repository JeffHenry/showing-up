import { SearchX } from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrgContext } from '@/context/orgContext';
import { useMyOrganizations } from '@/features/orgs/api/useMyOrganizations';
import { OrgNav } from '@/features/orgs/components/OrgNav';
import { OrgSwitcher } from '@/features/orgs/components/OrgSwitcher';
import { APP_NAME } from '@/lib/constants';

/**
 * Layout for `/orgs/:orgId/*`: finds the organization among the user's memberships and provides
 * it, with their role, through `OrgContext`.
 *
 * Loaded with the route's `lazy`, never imported eagerly: it pulls in the Supabase client, which
 * must stay out of the initial bundle.
 */
export function OrgLayout() {
  const { orgId } = useParams();
  const { data: orgs, isPending, isFetching, isError, refetch } = useMyOrganizations();
  const membership = orgs?.find((org) => org.id === orgId);

  if (orgs && membership) {
    const { role, ...org } = membership;
    return (
      <OrgContext value={{ org, role }}>
        <div className="space-y-6">
          <div className="space-y-4 border-b">
            <OrgSwitcher current={membership} orgs={orgs} />
            <OrgNav />
          </div>
          <Outlet />
        </div>
      </OrgContext>
    );
  }

  // Not in the cached list yet, but a refetch is under way (e.g. just joined): wait for it.
  if (isPending || isFetching) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading organization…</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="We couldn't load this organization"
        message="Check your connection and try again."
        reset={() => {
          void refetch();
        }}
      />
    );
  }

  // The same answer for "doesn't exist" and "not a member", so it reveals nothing either way.
  return (
    <div className="space-y-6">
      <title>{`Organization not found · ${APP_NAME}`}</title>
      <PageHeader title="Organization not found" />
      <EmptyState
        icon={SearchX}
        title="We couldn't find that organization"
        description="It may have been deleted, or you might not be a member. To join, ask its coordinator for an invite link."
        action={
          <Button asChild>
            <Link to="/orgs">Your organizations</Link>
          </Button>
        }
      />
    </div>
  );
}
