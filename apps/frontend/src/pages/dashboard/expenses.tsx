import { ExpensesChart } from '@/features/expenses/components/expenses-chart.tsx';
import { ExpensesTable } from '@/features/expenses/components/expenses-table.tsx';
import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item.tsx';
import { useDispatch } from 'react-redux';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import ExpensesCreate from '@/features/expenses/components/expenses-create.tsx';

export default function Expenses() {
  const dispatch = useDispatch();
  return (
    <>
      <Item className="px-0">
        <ItemContent>
          <ItemTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">
            {i18n.t('expenses')}
          </ItemTitle>
          <ItemDescription>{i18n.t('expenses_subtitle')}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button onClick={() => dispatch(setExpensesDrawerId(NEW_ENTITY_ID))}>
            {i18n.t('create_expense')}
          </Button>
        </ItemActions>
      </Item>

      <ExpensesCreate />

      <ExpensesChart />

      <ExpensesTable />
    </>
  );
}
