import type { MembershipRole } from '@/context/orgContext';
import { ROLE_LABELS } from '@/lib/roles';

/** The user's role as text (never color alone). */
export function RoleBadge({ role }: { role: MembershipRole }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {ROLE_LABELS[role]}
    </span>
  );
}
