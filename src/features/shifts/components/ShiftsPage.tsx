import { Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { z } from 'zod';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { ShiftList } from '@/features/shifts/components/ShiftList';
import { ShiftRangeNav } from '@/features/shifts/components/ShiftRangeNav';
import { deletedShiftTitle } from '@/features/shifts/navigationState';
import { useTypedSearchParams } from '@/hooks/useTypedSearchParams';
import { APP_NAME } from '@/lib/constants';
import { timeZoneGenericName } from '@/lib/dates';

const paramsSchema = z.object({
  when: z.enum(['upcoming', 'past']).catch('upcoming'),
});

/** Every member browses the organization's shifts here; coordinators and owners add them. */
export function ShiftsPage() {
  const { org, role } = useOrg();
  const [{ when }] = useTypedSearchParams(paramsSchema);
  const deleted = deletedShiftTitle(useLocation().state);
  // UX only: row-level security decides who can create shifts.
  const canCreate = role !== 'volunteer';

  return (
    <div className="max-w-3xl space-y-6">
      <title>{`Shifts · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title="Shifts"
        description={`Times are in ${timeZoneGenericName(org.timezone)}.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to={`/orgs/${org.id}/shifts/new`}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New shift
              </Link>
            </Button>
          ) : undefined
        }
      />
      {deleted && (
        <p role="status" className="text-sm font-medium">
          Deleted “{deleted}”.
        </p>
      )}
      <ShiftRangeNav when={when} />
      {/* A new list (and focus/announcement state) for each range. */}
      <ShiftList
        key={when}
        orgId={org.id}
        timeZone={org.timezone}
        when={when}
        canCreate={canCreate}
      />
    </div>
  );
}
