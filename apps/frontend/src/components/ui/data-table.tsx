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

import { TOTAL } from '@/constant.ts';

/**
 * Where a column's contents sit, declared once and applied to the heading *and* the cells.
 *
 * Figures belong on the right and words on the left; what was irritating was not either choice
 * but that each table made them separately, so a right-aligned column could carry a
 * left-aligned heading.
 */
export type ColumnAlign = 'left' | 'right' | 'center';

const alignmentClass = (align: ColumnAlign | undefined) =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

declare module '@tanstack/react-table' {
  // The generics are TanStack's own signature and must be restated to widen the interface, even
  // though neither is referenced here.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface ColumnMeta<TData, TValue> {
    align?: ColumnAlign;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as React from 'react';
import { dateBetweenFilterFn } from '../tanstack-table';

interface DataTableProps<TData, TValue> {
  children?: (table: ReturnType<typeof useReactTable<TData>>) => ReactNode;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
}

export function DataTable<TData, TValue>({
  children,
  columns,
  data,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
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
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
  });

  const sortedRows = table.getRowModel().rows;
  const isTotalRow = (row: (typeof sortedRows)[number]) =>
    (row.original as { id?: string })?.id === TOTAL;
  const orderedRows = [...sortedRows.filter((row) => !isTotalRow(row)), ...sortedRows.filter(isTotalRow)];

  return (
    <div>
      {/* Inside the frame, not floating above it. The filters were rendered outside the border,
          so nothing said which table they applied to — the complaint was that they looked
          unrelated to it, and they were. */}
      {/* Sorting must never move the summary. A total that lands in the middle of the rows it
          totals is worse than no total, so it is taken out of the sorted set and appended —
          which also leaves every column free to sort in either direction. */}
      <div className="overflow-hidden rounded-md border">
        {children ? (
          <div className="bg-muted/40 flex flex-wrap items-center gap-3 border-b px-2 py-2">
            {children(table)}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={alignmentClass(header.column.columnDef.meta?.align)}
                      style={{
                        minWidth: header.column.columnDef.size,
                        maxWidth: header.column.columnDef.size,
                      }}
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
            {orderedRows.length ? (
              orderedRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  // The totals row is a summary, not another record. Bold text alone left it
                  // reading as one more row of data.
                  className={
                    (row.original as { id?: string })?.id === TOTAL
                      ? 'bg-muted/60 border-t-2 font-medium even:bg-muted/60'
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={alignmentClass(cell.column.columnDef.meta?.align)}
                      style={{
                        minWidth: cell.column.columnDef.size,
                        maxWidth: cell.column.columnDef.size,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-2">
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
