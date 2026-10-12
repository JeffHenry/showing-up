import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { RoleBadge } from '@/features/orgs/components/RoleBadge';
import type { MyOrganization } from '@/features/orgs/types';

export function OrgListItem({ org }: { org: MyOrganization }) {
  return (
    <li>
      <Link
        to={`/orgs/${org.id}`}
        className="flex items-center gap-4 rounded-lg border p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{org.name}</span>
            <RoleBadge role={org.role} />
          </div>
          {org.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{org.description}</p>
          )}
        </div>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
