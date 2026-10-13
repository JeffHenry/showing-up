import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { ShiftWhen } from '@/features/shifts/types';

const RANGES: { when: ShiftWhen; label: string; search: string }[] = [
  { when: 'upcoming', label: 'Upcoming', search: '' },
  { when: 'past', label: 'Past', search: '?when=past' },
];

/** Switches between upcoming and past shifts. The choice lives in the URL, so it can be shared. */
export function ShiftRangeNav({ when }: { when: ShiftWhen }) {
  return (
    <nav aria-label="Shift dates" className="flex gap-2">
      {RANGES.map((range) => {
        const isCurrent = range.when === when;
        return (
          <Button key={range.when} asChild size="sm" variant={isCurrent ? 'secondary' : 'ghost'}>
            <Link to={{ search: range.search }} aria-current={isCurrent ? 'true' : undefined}>
              {range.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
