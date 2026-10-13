import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { useAcceptedInvites } from '@/features/invites/api/useInviteQueries';
import { formatDate } from '@/lib/dates';
import { ROLE_LABELS } from '@/lib/roles';

interface RecentlyAcceptedInvitesProps {
  orgId: string;
  timeZone: string;
}

/** Who joined through an invite in the last 30 days, and who invited them. */
export function RecentlyAcceptedInvites({ orgId, timeZone }: RecentlyAcceptedInvitesProps) {
  const { data: invites, isPending, isError, refetch } = useAcceptedInvites(orgId);

  if (isPending) {
    return (
      <div role="status">
        <span className="sr-only">Loading accepted invites…</span>
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="We couldn't load accepted invites"
        message="Check your connection and try again."
        reset={() => {
          void refetch();
        }}
      />
    );
  }

  if (invites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No invites accepted in the last 30 days.</p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {invites.map((invite) => (
        <li key={invite.id} className="space-y-1 p-3">
          <p>
            <span className="font-medium">{invite.usedByName ?? 'A former member'}</span> joined as
            a {ROLE_LABELS[invite.role].toLowerCase()}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(invite.usedAt, timeZone)}
            {invite.createdByName && ` · Invited by ${invite.createdByName}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
