import { CalendarDays, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { LeaveOrganization } from '@/features/orgs/components/LeaveOrganization';
import { OrgAbout } from '@/features/orgs/components/OrgAbout';
import { ROLE_LABELS } from '@/lib/roles';
import { APP_NAME } from '@/lib/constants';

/** An organization's home page. Shifts take over the main area once they're built. */
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
      <EmptyState
        icon={CalendarDays}
        title="Shifts are coming next"
        description="This is where the organization's upcoming volunteer shifts will appear."
      />
      <section aria-labelledby="membership-heading" className="space-y-3 border-t pt-6">
        <h2 id="membership-heading" className="text-lg font-medium">
          Your membership
        </h2>
        <LeaveOrganization />
      </section>
    </div>
  );
}
