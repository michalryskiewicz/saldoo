import type { ColumnDef } from '@tanstack/react-table';
import { formatFrequency } from '@/lib/formats.ts';
import { DataTable } from '@/components/ui/data-table.tsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { TOTAL, FREQUENCY, SEVERITY } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import ExpensesTableActions from '@/features/expenses/components/expenses-table-actions.tsx';
import { useState } from 'react';
import { Cell, Header } from '@/components/tanstack-table';
import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';

/** A row as the table sees it: an expense with its tag joined in. */
export type ExpenseRow = DBExpense & { tag?: DBTag };

// eslint-disable-next-line react-refresh/only-export-components
export const columns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: 'description',
    meta: { grow: true },
    cell: ({ row }) => <Cell.Description id={row.original.id} name={row.original.description} />,
    header: ({ column }) => <Header.Sort column={column} header="description" />,
  },
  {
    accessorKey: 'expense',
    cell: ({ row }) => {
      const { id, expense, currency } = row.original;
      return <Cell.Money id={id} price={expense} currency={currency} />;
    },
    header: ({ column }) => (
      <Header.Info column={column} header="expense" tooltip="price_exchanged_automatically" />
    ),
  },
  {
    accessorKey: 'severity',
    header: ({ column }) => <Header.Sort column={column} header="severity" />,
    cell: ({ row }) => {
      const { id, severity } = row.original;
      return <Cell.Severity id={id} severity={severity} />;
    },
  },
  {
    accessorKey: 'execution',
    header: i18n.t('execution'),
    cell: ({ row }) => {
      const { id, execution, frequency } = row.original;
      return <Cell.Text id={id} name={formatFrequency(execution, frequency)} />;
    },
  },
  {
    accessorKey: 'frequency',
    header: i18n.t('frequency'),
    cell: ({ row }) => {
      const { id, frequency } = row.original;
      return <Cell.Frequency id={id} frequency={frequency} />;
    },
  },
  {
    accessorKey: 'tag.name',
    header: i18n.t('forms.category'),
    cell: ({ row }) => <Cell.Tags tag={row.original?.tag?.name} />,
  },
  {
    accessorKey: 'strategyPart',
    header: i18n.t('forms.strategy-part'),
    cell: ({ row }) => <Cell.Tags tag={i18n.t(row.original?.strategyPart as TranslationKey)} />,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      if (row.original.id === TOTAL) {
        return null;
      }
      return <ExpensesTableActions row={row} />;
    },
  },
];

export const ExpensesTable = () => {
  const { allExpenses } = useListExpenses();
  const [severity, setSeverity] = useState<keyof typeof SEVERITY | undefined>(undefined);
  const [frequency, setFrequency] = useState<keyof typeof FREQUENCY | undefined>(undefined);

  let dataToTable = allExpenses ?? [];

  dataToTable = dataToTable.filter((t) => {
    const severityMatch = severity === undefined || t.severity === severity;
    const frequencyMatch = frequency === undefined || t.frequency === frequency;
    return severityMatch && frequencyMatch;
  });

  // A summary row rather than a stored expense, so it is shaped like one on purpose.
  const totalRow: ExpenseRow[] = dataToTable.length
    ? [
        {
          id: TOTAL,
          createdAt: new Date(),
          description: 'TOTAL',
          expense: dataToTable.reduce((acc, curr) => acc + (curr.expense || 0), 0),
          currency: dataToTable[0].currency,
          severity: null,
        },
      ]
    : [];

  return (
    <DataTable columns={columns} data={[...dataToTable, ...totalRow]}>
      {() => (
        <>
          <div className="flex flex-col w-full justify-start gap-4 lg:flex-row  lg:gap-8">
            <Tabs value={severity || ''}>
              <TabsList>
                {Object.values(SEVERITY).map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    onClick={() => setSeverity((prev) => (prev === value ? undefined : value))}
                  >
                    {i18n.t(value as TranslationKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Tabs value={frequency || ''}>
              <TabsList>
                {Object.values(FREQUENCY).map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    onClick={() => setFrequency((prev) => (prev === value ? undefined : value))}
                  >
                    {i18n.t(value as TranslationKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

        </>
      )}
    </DataTable>
  );
};
