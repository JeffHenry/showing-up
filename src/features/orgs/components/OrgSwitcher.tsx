import { Building2, Check, ChevronsUpDown, LayoutList, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MyOrganization } from '@/features/orgs/types';

interface OrgSwitcherProps {
  current: MyOrganization;
  orgs: MyOrganization[];
}

/** Shows the current organization and moves between the user's organizations. */
export function OrgSwitcher({ current, orgs }: OrgSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The label repeats the visible name, so voice-control users can say what they see. */}
        <Button
          variant="outline"
          className="max-w-full"
          aria-label={`Switch organization. Current: ${current.name}`}
        >
          <Building2 aria-hidden="true" data-icon="inline-start" />
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown aria-hidden="true" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem key={org.id} asChild>
            <Link to={`/orgs/${org.id}`} aria-current={org.id === current.id ? 'page' : undefined}>
              <Check
                aria-hidden="true"
                className={org.id === current.id ? 'opacity-100' : 'opacity-0'}
              />
              <span className="truncate">{org.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/orgs">
            <LayoutList aria-hidden="true" />
            All organizations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/orgs/new">
            <Plus aria-hidden="true" />
            New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
