'use no memo';

import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';
import { useCategories } from '@/features/hooks/use-categories.tsx';

import { TableSearch } from '@/components/ui/table-search.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Download, PencilLine } from 'lucide-react';
import i18n from '@/i18n.ts';
import type { Locale } from '@/i18n.ts';
import { toast } from 'sonner';
import { TOTAL } from '@/constant.ts';
import { toISODate } from '@/lib/dates.ts';
import { sheetForTransactions } from '@/features/transactions/services/sheet-export.service.ts';
import type { Table } from '@tanstack/react-table';
import z from 'zod';
import { Field, Form } from '@/components/hook-form';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { updateDBTransactions } from '@/database/transactions.ts';
import type { STRATEGY_PART } from '@/constant.ts';
import type { TransactionRow } from '@/features/transactions/views/transactions-table.tsx';
import type { TransactionRange } from '@/features/transactions/services/transactions-range.service.ts';

const formSchema = z.object({
  expenseId: z.string().optional(),
  tagId: z.string({ error: i18n.t('errors.field-required') }).optional(),
  strategyPart: z.string({ error: i18n.t('errors.field-required') }).optional(),
});

const RANGES: { value: TransactionRange; label: string }[] = [
  { value: 'all', label: i18n.t('entire_time') },
  { value: 'this-month', label: i18n.t('this_month') },
  { value: 'previous-month', label: i18n.t('previous_month') },
];

type TransactionDataTableTopBarProps = {
  table: Table<TransactionRow>;
  query: string;
  onQueryChange: (query: string) => void;
  range: TransactionRange;
  onRangeChange: (range: TransactionRange) => void;
};

/**
 * Writes the sheet and hands it to the browser to save.
 *
 * A blob and a click, never a trip through anything of ours: this file is somebody's whole payment
 * history, and the only correct number of servers for it to pass through on the way to their disk
 * is nought.
 */
const download = (csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = `saldoo-${toISODate(new Date())}.csv`;
  link.click();

  URL.revokeObjectURL(url);
};

export default function TransactionsDataTableTopBar({
  table,
  query,
  onQueryChange,
  range,
  onRangeChange,
}: TransactionDataTableTopBarProps) {
  const { allExpenses } = useListExpenses();
  const { budgetingPartsOptions, tags } = useCategories();

  const [open, setOpen] = useState(false);

  /**
   * What the table is showing, which is what the button appears to offer.
   *
   * The range and the search have already narrowed this list, and exporting the whole database from
   * a screen filtered to March would be the button doing something other than what it looks like.
   * Re-importing part of an export is safe by design — absence never deletes — so a narrowed export
   * is a narrowed edit, not a lossy one.
   *
   * The totals row is dropped: it is a sum the screen draws, not a payment anybody made.
   */
  const shown = table
    .getFilteredRowModel()
    .rows.map((row) => row.original)
    .filter((transaction) => transaction.id !== TOTAL);

  const exportSheet = async () => {
    const csv = await sheetForTransactions(shown, i18n.language as Locale);

    download(csv);
    toast(i18n.t('sheet.exported', { count: shown.length }));
  };

  const expenses = allExpenses?.map((expense) => ({
    value: expense.id,
    label: expense.description,
  })) ?? [];

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
      {/* First on a phone: of the three controls it is the one that narrows the list fastest. */}
      <div className="order-first w-full lg:order-last lg:ml-auto lg:w-auto">
        <TableSearch value={query} onChange={onQueryChange} />
      </div>

      <div className="flex min-w-0 items-center gap-2 lg:gap-6">
        <Select value={range} onValueChange={(value) => onRangeChange(value as TransactionRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          disabled={!shown.length}
          onClick={() => void exportSheet()}
          data-testid="export-sheet"
        >
          <Download /> {i18n.t('sheet.export')}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={!(table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected())}
              onClick={() => setOpen(true)}
            >
              <PencilLine /> {i18n.t('edit')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <Form
              noDevTools
              schema={formSchema}
              onSubmit={async (values) => {
                const transactionsToUpdate = table.getSelectedRowModel()?.rows?.map((row) => ({
                  key: row.original.id,
                  changes: {
                    tagId: values.tagId,
                    strategyPart: values.strategyPart as STRATEGY_PART,
                    expenseId: values.expenseId,
                  },
                }));

                await updateDBTransactions(transactionsToUpdate);

                setOpen(false);
              }}
            >
              <DialogHeader className="mb-4">
                <DialogTitle>{i18n.t('edit_title')}</DialogTitle>
                <DialogDescription>{i18n.t('edit_description')}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Field.Select
                    name="expenseId"
                    label={i18n.t('forms.expense')}
                    fullWidth
                    helperText={i18n.t('forms.expense-helper-text')}
                    options={expenses}
                  />
                </div>
                <div className="grid gap-3">
                  <Field.Select
                    name="tagId"
                    label={i18n.t('forms.category')}
                    fullWidth
                    helperText={i18n.t('forms.category-helper-text')}
                    placeholder={i18n.t('forms.category-placeholder')}
                    options={tags}
                  />
                </div>
                <div className="grid gap-3">
                  <Field.Select
                    fullWidth
                    name="strategyPart"
                    label={i18n.t('forms.strategy-part')}
                    infoTooltip={i18n.t('forms.strategy-part-tooltip')}
                    options={budgetingPartsOptions}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button variant="outline">{i18n.t('cancel')}</Button>
                </DialogClose>
                <Button type="submit">{i18n.t('save_changes')}</Button>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
