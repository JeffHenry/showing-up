import { useRef, useState } from 'react';
import { z } from 'zod';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/useAuth';
import { useOrgMembers } from '@/features/members/api/useMembers';
import { MemberActions } from '@/features/members/components/MemberActions';
import { MemberFilters } from '@/features/members/components/MemberFilters';
import { MemberRow } from '@/features/members/components/MemberRow';
import type { OrgMember } from '@/features/members/types';
import { useTypedSearchParams } from '@/hooks/useTypedSearchParams';

const filtersSchema = z.object({
  q: z.string().catch(''),
  role: z.enum(['owner', 'coordinator', 'volunteer']).optional().catch(undefined),
});

function matches(member: OrgMember, query: string, role: OrgMember['role'] | undefined) {
  if (role && member.role !== role) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    (member.fullName ?? '').toLowerCase().includes(needle) ||
    member.email.toLowerCase().includes(needle)
  );
}

interface MemberRosterProps {
  orgId: string;
  orgName: string;
  timeZone: string;
  /** Owners get a Manage menu on each row. */
  canManage: boolean;
}

/** The organization's members, with search and a role filter kept in the URL. */
export function MemberRoster({ orgId, orgName, timeZone, canManage }: MemberRosterProps) {
  const { user } = useAuth();
  const { data: members, isPending, isError, refetch } = useOrgMembers(orgId);
  const [filters, setFilters] = useTypedSearchParams(filtersSchema);
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const heading = (
    <h2 ref={headingRef} tabIndex={-1} className="text-lg font-medium outline-none">
      Members{members ? ` (${String(members.length)})` : ''}
    </h2>
  );

  if (isPending) {
    return (
      <div className="space-y-4">
        {heading}
        <div role="status" className="space-y-2">
          <span className="sr-only">Loading members…</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        {heading}
        <ErrorFallback
          title="We couldn't load the member list"
          message="Check your connection and try again."
          reset={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  const visible = members.filter((member) => matches(member, filters.q, filters.role));
  const filtered = visible.length !== members.length;

  return (
    <div className="space-y-4">
      {heading}
      <MemberFilters query={filters.q} role={filters.role} onChange={setFilters} />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {filtered && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {visible.length} of {members.length} members.
        </p>
      )}
      {visible.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">No members match your search.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({ q: undefined, role: undefined });
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((member) => {
            const isYou = member.userId === user?.id;
            return (
              <MemberRow
                key={member.userId}
                member={member}
                isYou={isYou}
                timeZone={timeZone}
                actions={
                  canManage ? (
                    <MemberActions
                      orgId={orgId}
                      orgName={orgName}
                      member={member}
                      isYou={isYou}
                      onDone={setAnnouncement}
                      afterRemoveFocusRef={headingRef}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
