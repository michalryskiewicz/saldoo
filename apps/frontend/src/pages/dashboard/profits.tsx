import ProfitsTable from '@/features/profits/components/profits-table.tsx';
import { useDispatch } from 'react-redux';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item.tsx';
import i18n from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import ProfitsCreatePage from '@/features/profits/components/profits-create.tsx';

export default function Profits() {
  const dispatch = useDispatch();

  return (
    <>
      <Item className="px-0">
        <ItemContent>
          <ItemTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">
            {i18n.t('profits')}
          </ItemTitle>
          <ItemDescription>{i18n.t('profits_subtitle')}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button onClick={() => dispatch(serProfitsDrawerId(NEW_ENTITY_ID))}>
            {i18n.t('create_profit')}
          </Button>
        </ItemActions>
      </Item>

      <ProfitsCreatePage />

      <ProfitsTable />
    </>
  );
}
