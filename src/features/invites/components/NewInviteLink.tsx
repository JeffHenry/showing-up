import { Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteUrl } from '@/features/invites/api/invitesApi';
import type { InviteRole, NewInvite } from '@/features/invites/types';
import { formatDate } from '@/lib/dates';
import { ROLE_LABELS } from '@/lib/roles';

interface NewInviteLinkProps {
  invite: NewInvite;
  role: InviteRole;
  timeZone: string;
  onCreateAnother: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** The link for a just-created invite. Its token is never retrievable again, so say so. */
export function NewInviteLink({ invite, role, timeZone, onCreateAnother }: NewInviteLinkProps) {
  const url = inviteUrl(invite.token);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const linkRef = useRef<HTMLInputElement>(null);

  // The form this replaced had focus; put keyboard and screen-reader users on the new link.
  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopyState('copied');
      },
      () => {
        setCopyState('failed');
      },
    );
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <label htmlFor="new-invite-link" className="text-sm font-medium">
          Invite link for a {ROLE_LABELS[role].toLowerCase()}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="new-invite-link"
            ref={linkRef}
            readOnly
            value={url}
            aria-describedby="new-invite-link-hint"
            onFocus={(event) => {
              event.target.select();
            }}
          />
          <Button type="button" onClick={copy}>
            <Copy aria-hidden="true" data-icon="inline-start" />
            Copy link
          </Button>
        </div>
        <p id="new-invite-link-hint" className="text-sm text-muted-foreground">
          Works once, for one person, until {formatDate(invite.expiresAt, timeZone)}. Copy it now:
          for security, it can&apos;t be shown again.
        </p>
      </div>
      <p role="status" className="text-sm">
        {copyState === 'copied' && 'Link copied.'}
        {copyState === 'failed' && "Couldn't copy automatically. Select the link and copy it."}
      </p>
      <Button type="button" variant="outline" onClick={onCreateAnother}>
        Create another invite
      </Button>
    </div>
  );
}
