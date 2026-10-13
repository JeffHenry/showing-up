import { ShieldX } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import type { MembershipRole } from '@/context/orgContext';
import { useOrg } from '@/context/useOrg';
import { APP_NAME } from '@/lib/constants';

/**
 * Layout route for organization pages limited to some roles. This is a UX guard only: the
 * database's row-level security and functions are what actually protect data.
 */
export function RequireRole({ roles }: { roles: readonly MembershipRole[] }) {
  const { org, role } = useOrg();

  if (roles.includes(role)) return <Outlet />;

  return (
    <div className="space-y-6">
      <title>{`No access · ${APP_NAME}`}</title>
      <PageHeader title="No access" />
      <EmptyState
        icon={ShieldX}
        title="You don't have access to this page"
        description={`Ask an owner of ${org.name} if you need it.`}
        action={
          <Button asChild>
            <Link to={`/orgs/${org.id}`}>Back to {org.name}</Link>
          </Button>
        }
      />
    </div>
  );
}
