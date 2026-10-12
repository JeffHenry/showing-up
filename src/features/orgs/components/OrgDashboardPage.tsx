import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useOrg } from '@/context/useOrg';
import { OrgAbout } from '@/features/orgs/components/OrgAbout';
import { ROLE_LABELS } from '@/features/orgs/roles';
import { APP_NAME } from '@/lib/constants';

/** An organization's home page. Shifts take over the main area once they're built. */
export function OrgDashboardPage() {
  const { org, role } = useOrg();

  return (
    <div className="space-y-6">
      <title>{`${org.name} · ${APP_NAME}`}</title>
      <PageHeader title={org.name} description={`Your role: ${ROLE_LABELS[role]}`} />
      <OrgAbout org={org} />
      <EmptyState
        icon={CalendarDays}
        title="Shifts are coming next"
        description="This is where the organization's upcoming volunteer shifts will appear."
      />
    </div>
  );
}
