'use no memo';

import type { ReactNode } from 'react';

import { DataTablePagination } from '@/components/ui/data-table-pagination.tsx';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnFiltersState,
  useReactTable,
  getFilteredRowModel,
  filterFns,
} from '@tanstack/react-table';

import { partitionTotalRow } from '@/components/ui/data-table-rows.service.ts';
import { DataTableMobileList } from '@/components/ui/data-table-mobile-list.tsx';
import type { MobileRole } from '@/components/ui/data-table-mobile.service.ts';
import { useIsMobile } from '@/hooks/use-mobile.ts';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';

/**
 * Where a column's contents sit, applied to the heading *and* the cells so the two can never
 * disagree — a right-aligned money column used to carry a left-aligned heading.
 */
export type ColumnAlign = 'left' | 'right' | 'center';

/**
 * One rule for the whole table: the column that takes up the slack reads from the left, and
 * everything after it is pushed against the same right edge as its own heading.
 *
 * Stated here rather than repeated as `align` on every column, because it is not a per-column
 * taste — it is what stops a row from reading as scattered. A column tight to its contents and
 * flushed right sits directly under its heading; the same column left-aligned strands its value
 * against the previous column's gap.
 *
 * A column may still say otherwise: a checkbox belongs in the middle of its column and asks for
 * `center`.
 */
const resolveAlign = (align: ColumnAlign | undefined, grow: boolean | undefined): ColumnAlign =>
  align ?? (grow ? 'left' : 'right');

const alignmentClass = (align: ColumnAlign) =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/** `100%` on one column and nothing on the rest is what makes the others shrink to fit. */
const widthClass = (grow: boolean | undefined) => (grow ? 'w-full' : undefined);

declare module '@tanstack/react-table' {
  // The generics are TanStack's own signature and must be restated to widen the interface, even
  // though neither is referenced here.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface ColumnMeta<TData, TValue> {
    align?: ColumnAlign;
    /**
     * Marks the one column that absorbs whatever width is left over; every other column is then
     * sized to its own contents.
     *
     * This is what `size` was meant to do and never did. A `min-width`/`max-width` pair on a
     * cell is advisory under `table-layout: auto`, so the browser went on handing the spare
     * width out evenly and the declared numbers changed nothing — which is why the rows read as
     * scattered. "Roczna" sat at the left edge of a 175px column because nothing had asked that
     * column to be narrower, not because anything had asked it to be that wide.
     */
    grow?: boolean;
    /**
     * What this column becomes below `md`, where the row is rebuilt as a line of text rather
     * than scrolled sideways. Defaults to a supporting detail, or to the title for the column
     * that grows. See `data-table-mobile.service.ts`.
     */
    mobile?: MobileRole;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Row } from '@tanstack/react-table';
import * as React from 'react';
import { dateBetweenFilterFn } from '../tanstack-table';

/** Room for fifty rows before anybody has to reach for a pager. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * The table's chrome: whatever sits above the rows and the pager that sits below them.
 *
 * One class for both, because the complaint was that the filters, the rows and the pager looked
 * like three unrelated things stacked up — and they were. The pager was rendered *outside* the
 * border with a margin of its own, so nothing tied it to the table it pages. Sharing the frame's
 * edges, the same tint, and the same horizontal padding as the cells is what makes the three read
 * as one object: the chrome lines up with the data instead of floating near it.
 */
const CHROME_ROW = 'bg-muted/30 px-3 py-2';

interface DataTableProps<TData, TValue> {
  children?: (table: ReturnType<typeof useReactTable<TData>>) => ReactNode;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /**
   * What to say when there is nothing to show.
   *
   * Passed in because only the caller knows *why* it is empty: "you have no expenses yet" and
   * "nothing matches what you typed" are different facts, and a table told only that its data is
   * empty cannot tell them apart. Defaults to the neutral wording.
   */
  emptyMessage?: ReactNode;
  /**
   * How the table is sorted before anybody clicks a heading.
   *
   * Some tables have an order that is part of what they mean rather than a preference: a list
   * of things falling due reads by date or it reads as nothing.
   */
  initialSorting?: SortingState;
  /**
   * Extra classes for one record's row, decided from the record itself.
   *
   * For state that belongs to the whole line rather than to any one cell — a duty that has been
   * paid or called off recedes as a row, not as five separately dimmed cells.
   */
  rowClassName?: (row: TData) => string | undefined;
  getRowId?: (row: TData, index: number) => string;
}

export function DataTable<TData, TValue>({
  children,
  columns,
  data,
  emptyMessage,
  initialSorting,
  rowClassName,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const resolvedGetRowId = React.useMemo<(row: TData, index: number) => string>(
    () =>
      getRowId ??
      ((row, index) => {
        const id = (row as { id?: unknown })?.id;
        return typeof id === 'string' || typeof id === 'number' ? String(id) : String(index);
      }),
    [getRowId]
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: resolvedGetRowId,
    filterFns: {
      ...filterFns,
      dateBetweenFilterFn,
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
  });

  const isMobile = useIsMobile();
  const { records, total } = partitionTotalRow(table.getRowModel().rows);

  const renderCells = (row: Row<TData>) =>
    row.getVisibleCells().map((cell) => {
      const { align, grow } = cell.column.columnDef.meta ?? {};

      return (
        <TableCell
          key={cell.id}
          className={cn(alignmentClass(resolveAlign(align, grow)), widthClass(grow))}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      );
    });

  return (
    <div className="overflow-hidden rounded-md border">
      {children ? (
        <div className={cn(CHROME_ROW, 'flex flex-wrap items-center gap-3 border-b')}>
          {children(table)}
        </div>
      ) : null}

      {/* Below `md` the rows are not rows. Swapped rather than restyled: eight columns cannot be
          dense and readable at 390px, so the honest choice is what to stop showing -- and a table
          left to scroll sideways makes that choice by hiding five columns behind a gesture nothing
          announces. */}
      {isMobile ? (
        <DataTableMobileList
          records={records}
          total={total}
          emptyMessage={emptyMessage ?? i18n.t('table.no_results')}
          rowClassName={rowClassName}
        />
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const { align, grow } = header.column.columnDef.meta ?? {};

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(alignmentClass(resolveAlign(align, grow)), widthClass(grow))}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {records.length ? (
              records.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(rowClassName?.(row.original))}
                >
                  {renderCells(row)}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyMessage ?? i18n.t('table.no_results')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {/* A summary is not another record, so it is not in the body. Appending it there put it
              at the mercy of anything that reorders rows, and left it wearing the body's stripe
              and hover as though it could be clicked or counted. `tfoot` makes "at the bottom" a
              property of the markup instead of a property of the current sort. */}
          {total ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">{renderCells(total)}</TableRow>
            </TableFooter>
          ) : null}
        </Table>
      )}

      <div className={cn(CHROME_ROW, 'border-t')}>
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
