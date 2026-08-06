import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { useDispatch } from 'react-redux';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { setPositionsDrawerId } from '@/store/preferences.slice.ts';
import PositionsCreate from '@/features/net-worth/components/positions-create.tsx';
import { PositionsTable } from '@/features/net-worth/components/positions-table.tsx';
import BondsCreate from '@/features/net-worth/components/bonds-create.tsx';
import { BondsTable } from '@/features/net-worth/components/bonds-table.tsx';
import { BondsChart } from '@/features/net-worth/components/bonds-chart.tsx';
import { setBondsDrawerId } from '@/store/preferences.slice.ts';
import { PageHeader as SectionHeader } from '@/components/page-header.tsx';

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

      {/* Its own section rather than another kind of position: a bond is the one holding whose
          value the app can work out, and mixing it in would hide that. */}
      <SectionHeader title={i18n.t('bonds.title')}>
        <Button variant="outline" onClick={() => dispatch(setBondsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('bonds.create')}
        </Button>
      </SectionHeader>

      <BondsCreate />

      <BondsChart />

      <BondsTable />
    </>
  );
}
