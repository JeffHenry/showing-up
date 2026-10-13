import { PageHeader } from '@/components/common/PageHeader';
import { useOrg } from '@/context/useOrg';
import { CreateInvite } from '@/features/invites/components/CreateInvite';
import { PendingInvites } from '@/features/invites/components/PendingInvites';
import { RecentlyAcceptedInvites } from '@/features/invites/components/RecentlyAcceptedInvites';
import { MemberRoster } from '@/features/members/components/MemberRoster';
import { APP_NAME } from '@/lib/constants';

/**
 * Coordinators and owners manage people here. It combines two features (members and invites),
 * so it lives at the app level rather than inside either one.
 */
export function MembersPage() {
  const { org, role } = useOrg();

  return (
    <div className="max-w-3xl space-y-10">
      <title>{`Members · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title="Members"
        description="See who's in your organization, and invite people with a single-use link."
      />
      <section aria-labelledby="invite-heading" className="space-y-4">
        <h2 id="invite-heading" className="text-lg font-medium">
          Invite someone
        </h2>
        <CreateInvite
          orgId={org.id}
          timeZone={org.timezone}
          canInviteCoordinators={role === 'owner'}
        />
      </section>
      <section className="space-y-4">
        <MemberRoster
          orgId={org.id}
          orgName={org.name}
          timeZone={org.timezone}
          canManage={role === 'owner'}
        />
      </section>
      <section aria-labelledby="pending-heading" className="space-y-4">
        <h2 id="pending-heading" className="text-lg font-medium">
          Pending invites
        </h2>
        <PendingInvites orgId={org.id} timeZone={org.timezone} />
      </section>
      <section aria-labelledby="accepted-heading" className="space-y-4">
        <h2 id="accepted-heading" className="text-lg font-medium">
          Recently accepted
        </h2>
        <RecentlyAcceptedInvites orgId={org.id} timeZone={org.timezone} />
      </section>
    </div>
  );
}
