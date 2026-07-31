import { ExpensesChart } from '@/features/expenses/components/expenses-chart.tsx';
import { ExpensesTable } from '@/features/expenses/components/expenses-table.tsx';
import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { useDispatch } from 'react-redux';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import ExpensesCreate from '@/features/expenses/components/expenses-create.tsx';

export default function Expenses() {
  const dispatch = useDispatch();
  return (
    <>
      <PageHeader title={i18n.t('expenses')} description={i18n.t('expenses_subtitle')}>
        <Button onClick={() => dispatch(setExpensesDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('create_expense')}
        </Button>
      </PageHeader>

      <ExpensesCreate />

      <ExpensesChart />

      <ExpensesTable />
    </>
  );
}
