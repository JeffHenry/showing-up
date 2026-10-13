import { UserPlus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { CreateInvite } from '@/features/invites/components/CreateInvite';
import { PendingInvites } from '@/features/invites/components/PendingInvites';
import { RecentlyAcceptedInvites } from '@/features/invites/components/RecentlyAcceptedInvites';
import { MemberRoster } from '@/features/members/components/MemberRoster';
import { APP_NAME } from '@/lib/constants';

/** The id of the invite section, so other pages can link straight to it (`members#invite`). */
const INVITE_SECTION_ID = 'invite';

/**
 * Coordinators and owners see and manage people here. It combines two features (members and
 * invites), so it lives at the app level rather than inside either one.
 */
export function MembersPage() {
  const { org, role } = useOrg();
  const { hash, key } = useLocation();
  const inviteHeadingRef = useRef<HTMLHeadingElement>(null);

  // Arriving at (or clicking a link to) the invite section: move focus there, which also
  // scrolls it into view, so keyboard and screen-reader users land where they asked to go.
  useEffect(() => {
    if (hash === `#${INVITE_SECTION_ID}`) inviteHeadingRef.current?.focus();
  }, [hash, key]);

  return (
    <div className="max-w-3xl space-y-10">
      <title>{`Members · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title="Members"
        description="Who's in your organization, and the invites you've sent."
        actions={
          <Button asChild>
            <Link to={`#${INVITE_SECTION_ID}`}>
              <UserPlus aria-hidden="true" data-icon="inline-start" />
              Invite people
            </Link>
          </Button>
        }
      />
      <section className="space-y-4">
        <MemberRoster
          orgId={org.id}
          orgName={org.name}
          timeZone={org.timezone}
          canManage={role === 'owner'}
        />
      </section>
      <section aria-labelledby={INVITE_SECTION_ID} className="scroll-mt-6 space-y-4">
        <h2
          id={INVITE_SECTION_ID}
          ref={inviteHeadingRef}
          tabIndex={-1}
          className="text-lg font-medium outline-none"
        >
          Invite people
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
      <section aria-labelledby="accepted-heading" className="space-y-4">
        <h2 id="accepted-heading" className="text-lg font-medium">
          Recently accepted
        </h2>
        <RecentlyAcceptedInvites orgId={org.id} timeZone={org.timezone} />
      </section>
    </div>
  );
}
