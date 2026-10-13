import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { MembershipRole } from '@/context/orgContext';

interface MemberFiltersProps {
  query: string;
  role: MembershipRole | undefined;
  /** A key set to `undefined` clears that filter. */
  onChange: (filters: { q?: string; role?: MembershipRole }) => void;
}

/** Search by name or email, and filter by role. The values live in the URL (`?q=&role=`). */
export function MemberFilters({ query, role, onChange }: MemberFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <label htmlFor="member-search" className="text-sm font-medium">
          Search by name or email
        </label>
        <Input
          id="member-search"
          type="search"
          value={query}
          onChange={(event) => {
            onChange({ q: event.target.value });
          }}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="member-role" className="text-sm font-medium">
          Role
        </label>
        <NativeSelect
          id="member-role"
          className="w-full sm:w-44"
          value={role ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              role:
                value === 'owner' || value === 'coordinator' || value === 'volunteer'
                  ? value
                  : undefined,
            });
          }}
        >
          <NativeSelectOption value="">All roles</NativeSelectOption>
          <NativeSelectOption value="owner">Owners</NativeSelectOption>
          <NativeSelectOption value="coordinator">Coordinators</NativeSelectOption>
          <NativeSelectOption value="volunteer">Volunteers</NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}
