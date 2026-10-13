import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

/**
 * The same answer for a deleted shift and another organization's, so it reveals nothing about
 * shifts the user can't see.
 */
export function ShiftNotFound({ orgId }: { orgId: string }) {
  return (
    <div className="space-y-6">
      <title>{`Shift not found · ${APP_NAME}`}</title>
      <PageHeader title="Shift not found" />
      <EmptyState
        icon={SearchX}
        title="We couldn't find that shift"
        description="It may have been deleted, or the link may be wrong."
        action={
          <Button asChild>
            <Link to={`/orgs/${orgId}/shifts`}>All shifts</Link>
          </Button>
        }
      />
    </div>
  );
}
