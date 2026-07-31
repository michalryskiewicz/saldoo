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

  return (
    <div>
      {/* Inside the frame, not floating above it. The filters were rendered outside the border,
          so nothing said which table they applied to — the complaint was that they looked
          unrelated to it, and they were. */}
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
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
