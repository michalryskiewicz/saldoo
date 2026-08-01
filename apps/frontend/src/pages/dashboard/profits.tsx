import ProfitsTable from '@/features/profits/components/profits-table.tsx';
import { useDispatch } from 'react-redux';
import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { Button } from '@/components/ui/button.tsx';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import ProfitsCreatePage from '@/features/profits/components/profits-create.tsx';
import { ProfitsChart } from '@/features/profits/components/profits-chart.tsx';

export default function Profits() {
  const dispatch = useDispatch();

  return (
    <>
      <PageHeader title={i18n.t('profits')} description={i18n.t('profits_subtitle')}>
        <Button onClick={() => dispatch(serProfitsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('create_profit')}
        </Button>
      </PageHeader>

      <ProfitsCreatePage />

      <ProfitsChart />

      <ProfitsTable />
    </>
  );
}
