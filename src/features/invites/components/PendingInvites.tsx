import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevokeInvite } from '@/features/invites/api/useInviteMutations';
import { usePendingInvites } from '@/features/invites/api/useInviteQueries';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/roles';

interface PendingInvitesProps {
  orgId: string;
  timeZone: string;
}

/** Invites nobody has used yet, with a way to revoke each one. */
export function PendingInvites({ orgId, timeZone }: PendingInvitesProps) {
  const { data: invites, isPending, isError, refetch } = usePendingInvites(orgId);
  const revoke = useRevokeInvite(orgId);

  if (isPending) {
    return (
      <div role="status" className="space-y-2">
        <span className="sr-only">Loading pending invites…</span>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="We couldn't load pending invites"
        message="Check your connection and try again."
        reset={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pending invites. Links you create appear here until someone uses them or they expire.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {invites.map((invite) => {
            const label = ROLE_LABELS[invite.role];
            const expires = formatDate(invite.expires_at, timeZone);
            const revoking = revoke.isPending && revoke.variables === invite.id;
            return (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">Expires {expires}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Revoke ${label.toLowerCase()} invite expiring ${expires}`}
                  disabled={revoking}
                  onClick={() => {
                    revoke.mutate(invite.id);
                  }}
                >
                  {revoking ? 'Revoking…' : 'Revoke'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {revoke.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(revoke.error).message}
        </p>
      )}
      <p role="status" className="sr-only">
        {revoke.isSuccess ? 'Invite revoked.' : ''}
      </p>
    </div>
  );
}
