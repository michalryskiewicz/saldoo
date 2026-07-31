'use no memo';
import { type Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import i18n from '@/i18n.ts';
import { countRecords } from '@/components/ui/data-table-rows.service.ts';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  const selected = table.getFilteredSelectedRowModel().rows.length;
  // Not `rows.length`: the summary row is shaped like a record, so counting rows claimed six
  // expenses where there were five.
  const records = countRecords(table.getFilteredRowModel().rows);

  return (
    // Stacked until there is room for a row. Held side by side at 390px, the row count and the
    // page-size label were squeezed into each other's letters — "5 wierszy" wrapped through
    // "Wierszy na stronę" and neither was readable.
    //
    // No padding of its own: it sits in the table's footer band, which owns the padding that
    // lines this up with the cells above it.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* A selection count only once there is a selection. Most of these tables cannot select at
          all, and "0 z 6" on one of those offers a number for something the reader cannot do. */}
      <div className="text-muted-foreground flex-1 text-sm">
        {selected > 0
          ? i18n.t('table.selected_count', { selected, total: records })
          : i18n.t('table.row_count', { count: records })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{i18n.t('table.rows_per_page')}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 25, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {i18n.t('table.page_of', {
            page: table.getState().pagination.pageIndex + 1,
            pages: table.getPageCount(),
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{i18n.t('table.first_page')}</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{i18n.t('table.previous_page')}</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{i18n.t('table.next_page')}</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{i18n.t('table.last_page')}</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
