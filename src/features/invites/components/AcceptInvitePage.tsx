import { Link, useNavigate, useParams } from 'react-router';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Button } from '@/components/ui/button';
import { useRedeemInvite } from '@/features/invites/api/useInviteMutations';
import { useInvitePreview } from '@/features/invites/api/useInviteQueries';
import { InviteCard } from '@/features/invites/components/InviteCard';
import { appError, toAppError } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/roles';

const backToOrgs = (
  <Button asChild variant="outline">
    <Link to="/orgs">Your organizations</Link>
  </Button>
);

/** Where invite links land (`/invite/:token`), after sign-in: preview, then join. */
export function AcceptInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const preview = useInvitePreview(token);
  const redeem = useRedeemInvite();

  if (preview.isPending) {
    return (
      <p role="status" className="py-12 text-center text-muted-foreground">
        Checking your invitation…
      </p>
    );
  }

  if (preview.isError) {
    const error = toAppError(preview.error);
    if (error.code === 'INVITE_NOT_FOUND') {
      return (
        <InviteCard title="This invite link isn't valid">
          <p className="text-muted-foreground">{error.message}</p>
          {backToOrgs}
        </InviteCard>
      );
    }
    return (
      <ErrorFallback
        title="We couldn't check your invitation"
        message={error.message}
        reset={() => {
          void preview.refetch();
        }}
      />
    );
  }

  const { orgId, orgName, role, status } = preview.data;

  if (status === 'member') {
    return (
      <InviteCard title={`You're already a member of ${orgName}`}>
        <Button asChild>
          <Link to={`/orgs/${orgId}`}>Open {orgName}</Link>
        </Button>
      </InviteCard>
    );
  }

  if (status === 'used' || status === 'expired') {
    return (
      <InviteCard
        title={status === 'used' ? 'This invite was already used' : 'This invite has expired'}
      >
        <p className="text-muted-foreground">
          {appError(status === 'used' ? 'INVITE_USED' : 'INVITE_EXPIRED').message}
        </p>
        {backToOrgs}
      </InviteCard>
    );
  }

  return (
    <InviteCard title={`Join ${orgName}?`}>
      <p className="text-muted-foreground">
        You&apos;ve been invited to join as a{' '}
        <span className="font-medium text-foreground">{ROLE_LABELS[role].toLowerCase()}</span>.
      </p>
      {redeem.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(redeem.error).message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={redeem.isPending || redeem.isSuccess}
          onClick={() => {
            redeem.mutate(token, {
              // Replace, so the single-use link drops out of the browser's history.
              onSuccess: (joinedOrgId) => {
                void navigate(`/orgs/${joinedOrgId}`, { replace: true });
              },
            });
          }}
        >
          {redeem.isPending ? 'Joining…' : `Join ${orgName}`}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/orgs">Not now</Link>
        </Button>
      </div>
    </InviteCard>
  );
}
