import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { useDispatch } from 'react-redux';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { setPositionsDrawerId } from '@/store/preferences.slice.ts';
import PositionsCreate from '@/features/net-worth/components/positions-create.tsx';
import { PositionsTable } from '@/features/net-worth/components/positions-table.tsx';

export default function Wealth() {
  const dispatch = useDispatch();

  return (
    <>
      <PageHeader title={i18n.t('holdings.title')} description={i18n.t('holdings.subtitle')}>
        <Button onClick={() => dispatch(setPositionsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('holdings.create')}
        </Button>
      </PageHeader>

      <PositionsCreate />

      <PositionsTable />
    </>
  );
}
