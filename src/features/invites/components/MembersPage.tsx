import { PageHeader } from '@/components/common/PageHeader';
import { useOrg } from '@/context/useOrg';
import { CreateInvite } from '@/features/invites/components/CreateInvite';
import { PendingInvites } from '@/features/invites/components/PendingInvites';
import { APP_NAME } from '@/lib/constants';

/** Coordinators and owners invite people here. The member roster arrives with member management. */
export function MembersPage() {
  const { org, role } = useOrg();

  return (
    <div className="max-w-2xl space-y-8">
      <title>{`Members · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title="Members"
        description="Invite people with a single-use link. They sign in, then join."
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
      <section aria-labelledby="pending-heading" className="space-y-4">
        <h2 id="pending-heading" className="text-lg font-medium">
          Pending invites
        </h2>
        <PendingInvites orgId={org.id} timeZone={org.timezone} />
      </section>
    </div>
  );
}
