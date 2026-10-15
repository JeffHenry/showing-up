import { useRef, useState } from 'react';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/useAuth';
import { useShiftSignups } from '@/features/signups/api/useShiftSignups';
import { RemoveSignup } from '@/features/signups/components/RemoveSignup';
import type { RosterShift } from '@/features/signups/types';
import { formatDate } from '@/lib/dates';

interface ShiftRosterProps {
  orgId: string;
  timeZone: string;
  shift: RosterShift;
}

/**
 * "Who's coming": the people signed up for a shift, for coordinators and owners. Until the
 * shift starts, they can remove someone (their own signup is dropped with Drop out instead).
 */
export function ShiftRoster({ orgId, timeZone, shift }: ShiftRosterProps) {
  const { user } = useAuth();
  const { data: signups, isPending, isError, refetch } = useShiftSignups(shift.id);
  const [now] = useState(() => new Date());
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Removing changes nothing once the shift has started, or if it was called off.
  const canRemove = !shift.cancelled_at && new Date(shift.start_time) > now;

  const heading = (
    <h2
      id="roster-heading"
      ref={headingRef}
      tabIndex={-1}
      className="text-lg font-medium outline-none"
    >
      Who’s coming{signups ? ` (${String(signups.length)})` : ''}
    </h2>
  );

  return (
    <section aria-labelledby="roster-heading" className="space-y-3">
      {heading}
      {isPending ? (
        <div role="status" className="space-y-2">
          <span className="sr-only">Loading who’s coming…</span>
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <ErrorFallback
          title="We couldn't load who's coming"
          message="Check your connection and try again."
          reset={() => {
            void refetch();
          }}
        />
      ) : signups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one has signed up yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {signups.map((signup) => {
            const isYou = signup.userId === user?.id;
            const name = signup.fullName ?? 'Unnamed member';
            return (
              <li key={signup.userId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {name}
                    {isYou && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Signed up {formatDate(signup.signedUpAt, timeZone)}
                  </p>
                </div>
                {canRemove && !isYou && (
                  <RemoveSignup
                    orgId={orgId}
                    shiftId={shift.id}
                    shiftTitle={shift.title}
                    userId={signup.userId}
                    name={name}
                    afterRemoveFocusRef={headingRef}
                    onRemoved={(removed) => {
                      setAnnouncement(`Removed ${removed} from the shift.`);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
