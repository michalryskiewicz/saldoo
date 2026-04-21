'use no memo';
import type { DBTag } from '@/database/tags.ts';

import type { DBExpense } from '@/database/expenses.ts';
import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';
import { useCategories } from '@/features/hooks/use-categories.tsx';

import { Input } from '@/components/ui/input.tsx';
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
import { PencilLine } from 'lucide-react';
import i18n from '@/i18n.ts';
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
import { type DBTransaction, updateDBTransactions } from '@/database/transactions.ts';
import type { STRATEGY_PART } from '@/constant.ts';

const formSchema = z.object({
  expenseId: z.string().optional(),
  tagId: z.string({ error: i18n.t('errors.field-required') }).optional(),
  strategyPart: z.string({ error: i18n.t('errors.field-required') }).optional(),
});

type TransactionDataTableTopBarProps = {
  table: Table<DBTransaction & { expense: DBExpense; tag: DBTag }>;
};

export default function TransactionsDataTableTopBar({ table }: TransactionDataTableTopBarProps) {
  const { allExpenses } = useListExpenses();
  const { budgetingPartsOptions, tags } = useCategories();

  const [open, setOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'all' | 'this-month' | 'previous-month'>(
    'all'
  );

  const expenses =
    allExpenses?.map((d) => {
      return {
        value: d.id,
        label: d.description,
      };
    }) ?? [];

  return (
    <div className="flex gap-4 items-center py-4">
      <Select
        value={selectedRange}
        onValueChange={(value) => {
          setSelectedRange(value as 'all' | 'this-month' | 'previous-month');
          if (value === 'this-month') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            table.getColumn('transactionDate')?.setFilterValue([startOfMonth, now]);
          } else if (value === 'previous-month') {
            const now = new Date();
            const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            table.getColumn('transactionDate')?.setFilterValue([startOfPrevMonth, endOfPrevMonth]);
          } else {
            table.getColumn('transactionDate')?.setFilterValue(undefined);
          }
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{i18n.t('entire_time')}</SelectItem>
          <SelectItem value="this-month">{i18n.t('this_month')}</SelectItem>
          <SelectItem value="previous-month">{i18n.t('previous_month')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        placeholder={i18n.t('filter_transactions')}
        value={(table.getColumn('description')?.getFilterValue() as string) ?? ''}
        onChange={(event) => {
          console.log('event.target.value === ', event.target.value);
          table.getColumn('description')?.setFilterValue(event.target.value);
        }}
        className="max-w-sm"
      />

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
              const transactionsToUpdate = table.getSelectedRowModel()?.rows?.map((r) => {
                return {
                  key: r.original.id,
                  changes: {
                    tagId: values.tagId,
                    strategyPart: values.strategyPart as STRATEGY_PART,
                    expenseId: values.expenseId,
                  },
                };
              });

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
  );
}
