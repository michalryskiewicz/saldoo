'use no memo';

import type { ReactNode } from 'react';
import { flexRender, type Cell, type Row } from '@tanstack/react-table';
import { groupCellsForPhone } from '@/components/ui/data-table-mobile.service.ts';
import { cn } from '@/lib/utils.ts';

/**
 * A table's rows below `md`, where they are not rows.
 *
 * Each record becomes one line of text with one figure on it: what it is called, the number, and
 * the supporting words small underneath. Eight columns cannot be dense *and* readable at 390px, so
 * the choice is not how to shrink the table but what to stop showing — and a table that scrolls
 * sideways makes that choice by hiding five columns behind a gesture nothing announces.
 *
 * Which column is which is declared once per table and read here; see
 * `data-table-mobile.service.ts`.
 */

type DataTableMobileListProps<TData> = {
  records: Row<TData>[];
  total?: Row<TData>;
  emptyMessage: ReactNode;
  /** The same per-record classes the table gives its rows: a phone is not a different truth. */
  rowClassName?: (row: TData) => string | undefined;
};

const renderCell = <TData,>(cell: Cell<TData, unknown>) =>
  flexRender(cell.column.columnDef.cell, cell.getContext());

export function DataTableMobileList<TData>({
  records,
  total,
  emptyMessage,
  rowClassName,
}: DataTableMobileListProps<TData>) {
  if (!records.length) {
    return <p className="text-muted-foreground px-3 py-8 text-center text-sm">{emptyMessage}</p>;
  }

  const totalCells = total ? groupCellsForPhone(total.getVisibleCells()) : undefined;

  return (
    <>
      <ul className="divide-y">
        {records.map((row) => {
          const { title, figure, details, actions } = groupCellsForPhone(row.getVisibleCells());

          return (
            <li
              key={row.id}
              className={cn('flex items-start gap-3 px-3 py-3', rowClassName?.(row.original))}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{title ? renderCell(title) : null}</div>

                {details.length ? (
                  // Separated by a middot rather than stacked: these are one sentence about the
                  // record, and a line each would make five lines out of a row.
                  //
                  // The dot trails its item rather than leading the next one. Wrapped, a leading
                  // dot starts the second line with punctuation; a trailing one ends the first
                  // line with it, which is how a sentence breaks.
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                    {details.map((cell, index) => (
                      <span key={cell.id} className="flex items-center gap-1.5">
                        {renderCell(cell)}
                        {index < details.length - 1 ? <span aria-hidden>·</span> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {figure ? (
                  // Named, so a test can ask for the figure rather than for a number: two money
                  // columns can hold the same amount, and then "the text 1980,00 zł" is two
                  // elements and the assertion is about whichever came first.
                  <div data-slot="row-figure" className="font-medium tabular-nums">
                    {renderCell(figure)}
                  </div>
                ) : null}
                {actions.length ? (
                  <div className="flex items-center">{actions.map(renderCell)}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {totalCells ? (
        // The same band the table's `tfoot` is, in the same order as the rows above it.
        <div
          data-slot="table-summary"
          className="bg-muted/50 flex items-center justify-between gap-3 border-t-2 px-3 py-2 font-medium"
        >
          {/* The cells carry their own type — the description cell already renders the summary's
              label as heading type — so this only places them. */}
          <span>{totalCells.title ? renderCell(totalCells.title) : null}</span>
          <span>{totalCells.figure ? renderCell(totalCells.figure) : null}</span>
        </div>
      ) : null}
    </>
  );
}
