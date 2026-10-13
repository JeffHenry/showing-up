import { CalendarDays, Plus, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { LeaveOrganization } from '@/features/orgs/components/LeaveOrganization';
import { OrgAbout } from '@/features/orgs/components/OrgAbout';
import { ROLE_LABELS } from '@/lib/roles';
import { APP_NAME } from '@/lib/constants';

/** An organization's home page. */
export function OrgDashboardPage() {
  const { org, role } = useOrg();

  return (
    <div className="space-y-6">
      <title>{`${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title={org.name}
        description={`Your role: ${ROLE_LABELS[role]}`}
        actions={
          // Role-gated for UX only: the database decides who can invite.
          role === 'volunteer' ? undefined : (
            <Button asChild>
              <Link to={`/orgs/${org.id}/members#invite`}>
                <UserPlus aria-hidden="true" data-icon="inline-start" />
                Invite people
              </Link>
            </Button>
          )
        }
      />
      <OrgAbout org={org} />
      <section aria-labelledby="shifts-heading" className="space-y-3 rounded-lg border p-4">
        <h2 id="shifts-heading" className="flex items-center gap-2 text-lg font-medium">
          <CalendarDays aria-hidden="true" className="size-5 text-muted-foreground" />
          Shifts
        </h2>
        <p className="text-sm text-muted-foreground">
          {role === 'volunteer'
            ? 'See when your help is needed.'
            : 'Post shifts and see what’s coming up.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={`/orgs/${org.id}/shifts`}>View shifts</Link>
          </Button>
          {role !== 'volunteer' && (
            <Button asChild>
              <Link to={`/orgs/${org.id}/shifts/new`}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New shift
              </Link>
            </Button>
          )}
        </div>
      </section>
      <section aria-labelledby="membership-heading" className="space-y-3 border-t pt-6">
        <h2 id="membership-heading" className="text-lg font-medium">
          Your membership
        </h2>
        <LeaveOrganization />
      </section>
    </div>
  );
}
