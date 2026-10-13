import { cn } from 'cn';
import { NavLink } from 'react-router';
import { useOrg } from '@/context/useOrg';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center rounded-t-sm border-b-2 px-1 pb-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11',
    isActive
      ? 'border-foreground text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  );

/**
 * The organization's sections. Shifts stays current on a shift's own pages. Members appears for coordinators and owners only; this is a UX
 * choice, while `RequireRole` and row-level security are what actually protect the page and data.
 */
export function OrgNav() {
  const { org, role } = useOrg();
  const base = `/orgs/${org.id}`;

  return (
    <nav aria-label="Organization" className="-mb-px flex gap-6">
      <NavLink to={base} end className={linkClass}>
        Overview
      </NavLink>
      <NavLink to={`${base}/shifts`} className={linkClass}>
        Shifts
      </NavLink>
      {role !== 'volunteer' && (
        <NavLink to={`${base}/members`} className={linkClass}>
          Members
        </NavLink>
      )}
    </nav>
  );
}
