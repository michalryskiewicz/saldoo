import i18n from '@/i18n.ts';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item.tsx';
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
      <Item className="px-0">
        <ItemContent>
          <ItemTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">
            {i18n.t('transactions')}
          </ItemTitle>
          <ItemDescription>{i18n.t('transactions_subtitle')}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button onClick={() => dispatch(setTransactionsDrawerId(NEW_ENTITY_ID))}>
            {i18n.t('create_transactions')}
          </Button>
        </ItemActions>
      </Item>

      <TransactionsCreate />

      <TransactionsTable />
    </>
  );
}
