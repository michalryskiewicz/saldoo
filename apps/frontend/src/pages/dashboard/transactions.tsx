import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { Button } from '@/components/ui/button.tsx';
import { setTransactionsDrawerId } from '@/store/preferences.slice.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { useDispatch } from 'react-redux';
import { TransactionsTable } from '@/features/transactions/views/transactions-table.tsx';
import TransactionsCreate from '@/features/transactions/views/transactions-create.tsx';

export default function Transactions() {
  const dispatch = useDispatch();

  return (
    <>
      <PageHeader title={i18n.t('transactions')} description={i18n.t('transactions_subtitle')}>
        <Button onClick={() => dispatch(setTransactionsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('create_transactions')}
        </Button>
      </PageHeader>

      <TransactionsCreate />

      <TransactionsTable />
    </>
  );
}
