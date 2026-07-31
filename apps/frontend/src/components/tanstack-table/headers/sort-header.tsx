// The direction is read from the column, not from props, so memoising this on props alone lets
// the arrow freeze and the click act on a stale reading — which is exactly what happened: a
// second click set "ascending" again instead of reversing.
'use no memo';

import i18n, { type TranslationKey } from '@/i18n.ts';
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
 * It is a plain button rather than a `Button`: a heading is a label, and giving it the filled
 * hover of a control made a row of headings read as a row of buttons — which is what it looked
 * like, because it was one. What a heading owes the reader is that clicking does something and
 * which way it is sorted, and text that firms up under the cursor carries both without pretending
 * to be a control.
 *
 * The direction is a single arrow. One `ArrowUpDown` in every state left a sorted column looking
 * exactly like an unsorted one — it answered "you may sort by this" rather than "this is how it
 * is sorted".
 */
export default function SortHeader<T extends Record<string, unknown>>({
  header,
  column,
}: SortHeaderProps<T>) {
  const direction = column.getIsSorted();
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;

  return (
    <button
      type="button"
      // Inherited rather than restated, so the heading cell stays the one place that decides how a
      // heading looks. `font: inherit` arrives through preflight; the casing has to be asked for,
      // because the UA stylesheet sets `text-transform: none` on a button and that is not
      // something inheritance overrides — which is how these two headings ended up in sentence
      // case while every non-sortable one beside them stayed upper.
      className="hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-1.5 rounded-sm [text-transform:inherit] transition-colors outline-none focus-visible:ring-[3px]"
      // TanStack's own handler, which reads the current state when the click happens rather than
      // when this rendered.
      onClick={column.getToggleSortingHandler()}
    >
      {i18n.t(header)}
      <Icon
        className={cn(
          'size-3.5 shrink-0 transition-colors',
          direction ? 'text-foreground' : 'text-muted-foreground/40'
        )}
        aria-hidden
      />
    </button>
  );
}
