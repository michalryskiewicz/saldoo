import i18n, { type TranslationKey } from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import type { Column } from '@tanstack/react-table';

type SortHeaderProps<T extends Record<string, unknown>> = {
  header: TranslationKey;
  column: Column<T>;
};

/**
 * A column heading that can be sorted, and that says what it did.
 *
 * The old icon was one `ArrowUpDown` in every state, so a sorted column looked exactly like an
 * unsorted one — the arrow answered "you may sort by this" rather than "this is how it is sorted".
 * Direction is a single arrow now, and the resting state is a faint hint that firms up on hover: a
 * heading should not shout an affordance at somebody who is reading.
 */
export default function SortHeader<T extends Record<string, unknown>>({
  header,
  column,
}: SortHeaderProps<T>) {
  const direction = column.getIsSorted();
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      // Inherits the heading's own type rather than restating it: the header cell already decided
      // this is small, quiet and uppercase.
      className="-ml-2 h-7 gap-1.5 px-2 text-xs font-medium tracking-wide uppercase"
      onClick={() => {
        column.toggleSorting(direction === 'asc');
      }}
    >
      {i18n.t(header)}
      <Icon
        className={cn(
          'size-3.5 shrink-0 transition-colors',
          direction ? 'text-foreground' : 'text-muted-foreground/40'
        )}
        aria-hidden
      />
    </Button>
  );
}
