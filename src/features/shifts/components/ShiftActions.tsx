import { Copy, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { CancelShift } from '@/features/shifts/components/CancelShift';
import { DeleteShift } from '@/features/shifts/components/DeleteShift';
import type { ShiftDetail, ShiftStatus } from '@/features/shifts/types';

interface ShiftActionsProps {
  shift: ShiftDetail;
  status: ShiftStatus;
}

/**
 * A coordinator's actions on a shift. What's offered follows the database's rules (which still
 * decide): upcoming shifts can be edited, cancelled, and deleted; cancelled ones only deleted;
 * once a shift starts it's locked. Any shift can be duplicated.
 */
export function ShiftActions({ shift, status }: ShiftActionsProps) {
  const { org } = useOrg();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const started = status === 'in-progress' || status === 'ended';

  return (
    <section aria-labelledby="shift-actions-heading" className="space-y-3 border-t pt-6">
      <h2
        id="shift-actions-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-medium outline-none"
      >
        Manage shift
      </h2>
      {started && (
        <p className="text-sm text-muted-foreground">
          This shift has started, so it can’t be changed. You can still duplicate it.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === 'scheduled' && (
          <Button asChild variant="outline">
            <Link to={`/orgs/${org.id}/shifts/${shift.id}/edit`}>
              <Pencil aria-hidden="true" data-icon="inline-start" />
              Edit
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to={`/orgs/${org.id}/shifts/new?from=${shift.id}`}>
            <Copy aria-hidden="true" data-icon="inline-start" />
            Duplicate
          </Link>
        </Button>
        {status === 'scheduled' && (
          <CancelShift
            shift={shift}
            afterCancelFocusRef={headingRef}
            onCancelled={() => {
              setAnnouncement('Shift cancelled.');
            }}
          />
        )}
        {!started && <DeleteShift shift={shift} />}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
