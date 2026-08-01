import DutiesTable from '@/features/duties/components/duties-table.tsx';
import ExpensesCreate from '@/features/expenses/components/expenses-create.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PageHeader } from '@/components/page-header.tsx';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import i18n from '@/i18n.ts';
import { useDispatch } from 'react-redux';

/**
 * The only thing creatable from this screen is an expense.
 *
 * Duties are not authored — each is worked out from an expense — so there is no "add a duty" to
 * offer. The expense drawer has to be mounted here anyway: it is where an empty table sends
 * people, and what clicking a row's description opens.
 */
export default function Duties() {
  const dispatch = useDispatch();

  return (
    <>
      <PageHeader title={i18n.t('duties')} description={i18n.t('duties_subtitle')}>
        <Button onClick={() => dispatch(setExpensesDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('create_expense')}
        </Button>
      </PageHeader>

      <ExpensesCreate />

      <DutiesTable />
    </>
  );
}
