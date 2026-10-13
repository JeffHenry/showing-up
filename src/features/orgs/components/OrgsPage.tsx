import { Building2, Plus } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyOrganizations } from '@/features/orgs/api/useMyOrganizations';
import { OrgListItem } from '@/features/orgs/components/OrgListItem';
import { APP_NAME } from '@/lib/constants';
import { isEntryNavigation } from '@/lib/redirects';

const newOrgButton = (
  <Button asChild>
    <Link to="/orgs/new">
      <Plus aria-hidden="true" data-icon="inline-start" />
      New organization
    </Link>
  </Button>
);

/** The organization a member just left, from the navigation state `LeaveOrganization` sets. */
function leftOrgName(state: unknown): string | null {
  return typeof state === 'object' &&
    state !== null &&
    'left' in state &&
    typeof state.left === 'string'
    ? state.left
    : null;
}

/** The signed-in home page: the user's organizations, or how to get started. */
export function OrgsPage() {
  const { data: orgs, isPending, isError, refetch } = useMyOrganizations();
  const location = useLocation();

  // Straight after signing in, someone with a single organization (most volunteers) skips the list.
  const [onlyOrg, ...otherOrgs] = orgs ?? [];
  if (isEntryNavigation(location.state) && onlyOrg && otherOrgs.length === 0) {
    return <Navigate to={`/orgs/${onlyOrg.id}`} replace />;
  }

  const hasOrgs = orgs !== undefined && orgs.length > 0;
  const left = leftOrgName(location.state);

  return (
    <div className="space-y-6">
      <title>{`Your organizations · ${APP_NAME}`}</title>
      <PageHeader
        title="Your organizations"
        description={hasOrgs ? 'Choose an organization to open.' : undefined}
        actions={hasOrgs ? newOrgButton : undefined}
      />
      <p role="status" className={left ? 'text-sm' : 'sr-only'}>
        {left ? `You left ${left}.` : ''}
      </p>
      {isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading your organizations…</span>
          <Skeleton className="h-18 w-full" />
          <Skeleton className="h-18 w-full" />
        </div>
      ) : isError ? (
        <ErrorFallback
          title="We couldn't load your organizations"
          message="Check your connection and try again."
          reset={() => {
            void refetch();
          }}
        />
      ) : hasOrgs ? (
        <ul className="space-y-3">
          {orgs.map((org) => (
            <OrgListItem key={org.id} org={org} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Building2}
          title="You're not in any organizations yet"
          description="Create one for your nonprofit, or ask its coordinator for an invite link to join."
          action={
            <Button asChild>
              <Link to="/orgs/new">Create an organization</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
