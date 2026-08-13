import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from '@/components/ui/button.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { ASSET_TYPE, NEW_ENTITY_ID } from '@/constant.ts';
import { db } from '@/database';
import { setBondsDrawerId, setPositionsDrawerId } from '@/store/preferences.slice.ts';
import PositionsCreate from '@/features/net-worth/components/positions-create.tsx';
import { PositionsTable } from '@/features/net-worth/components/positions-table.tsx';
import { AllocationTable } from '@/features/net-worth/components/allocation-table.tsx';
import { RevalueHoldings } from '@/features/net-worth/components/revalue-holdings.tsx';
import BondsCreate from '@/features/net-worth/components/bonds-create.tsx';
import { BondsTable } from '@/features/net-worth/components/bonds-table.tsx';
import { BondsChart } from '@/features/net-worth/components/bonds-chart.tsx';
import { NetWorthChart } from '@/features/net-worth/components/net-worth-chart.tsx';
import { GrowthChart } from '@/features/net-worth/components/growth-chart.tsx';
import {
  OWED_TAB,
  UNTYPED_TAB,
  wealthTabs,
} from '@/features/net-worth/services/wealth-tabs.service.ts';

const OVERVIEW = 'OVERVIEW';

/**
 * Wealth, one question at a time.
 *
 * It used to be six blocks stacked on one page — two charts, three tables and a form — each added on
 * its own and none of them ever weighed against the others. Everything was true and nothing was
 * findable, and bonds sat at the bottom as though they were an afterthought rather than a kind of
 * holding like any other.
 *
 * So: an overview that answers *how much and is it growing*, and a tab per kind of thing held. Bonds
 * are one of those tabs now.
 *
 * **Only the kinds something is held under** — see `wealthTabs`. Ten tabs, eight of them empty, is a
 * filing cabinet rather than somebody's money.
 */
export default function Wealth() {
  const dispatch = useDispatch();
  const positions = useLiveQuery(() => db.positions.toArray(), []) || [];
  const bonds = useLiveQuery(() => db.bonds.toArray(), []) || [];

  const tabs = wealthTabs(positions, bonds.length > 0);
  const [tab, setTab] = useState(OVERVIEW);

  return (
    <>
      {/* Both ways in live here rather than inside a tab. Adding is an action of the page, and the
          bonds button in particular could not live in the bonds tab: that tab only exists once bonds
          do, so the first one would have been impossible to add. */}
      <PageHeader title={i18n.t('holdings.title')} description={i18n.t('holdings.subtitle')}>
        <Button onClick={() => dispatch(setPositionsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('holdings.create')}
        </Button>
        <Button variant="outline" onClick={() => dispatch(setBondsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('bonds.create')}
        </Button>
      </PageHeader>

      {/* Outside the tabs on purpose: a drawer that lives inside one closes when the tab changes
          underneath it, and a holding can be opened from the allocation as well as from its own list. */}
      <PositionsCreate />
      <BondsCreate />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex gap-1 overflow-x-auto whitespace-nowrap">
          <TabsTrigger value={OVERVIEW}>{i18n.t('holdings.overview_tab')}</TabsTrigger>
          {tabs.map((one) => (
            <TabsTrigger key={one} value={one}>
              {one === UNTYPED_TAB
                ? i18n.t('holdings.untyped_tab')
                : one === OWED_TAB
                  ? i18n.t('holdings.owed_tab')
                  : i18n.t(`holdings.type.${one}` as TranslationKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={OVERVIEW} className="flex flex-col gap-4">
          {/* First, because it is the question the screen exists to answer: how much, and is it
              growing. What it is made of comes after. */}
          <GrowthChart />
          <NetWorthChart />
          <AllocationTable />
          <RevalueHoldings />
        </TabsContent>

        {tabs.map((one) => (
          <TabsContent key={one} value={one} className="flex flex-col gap-4">
            {one === UNTYPED_TAB && (
              <p className="text-warning text-sm">{i18n.t('holdings.untyped_tab_hint')}</p>
            )}

            {/* Bonds are priced by the app rather than stated by the person, so their tab is their own
                chart and table rather than a filtered list of positions. */}
            {one === ASSET_TYPE.BONDS ? (
              <>
                <BondsChart />
                <BondsTable />
              </>
            ) : (
              <PositionsTable
                only={(position) => {
                  if (one === OWED_TAB) return position.kind === 'liability';
                  if (one === UNTYPED_TAB) {
                    return position.assetType === undefined && position.kind === 'asset';
                  }

                  // Held, not owed: a mortgage against a flat belongs under what is owed, not among
                  // the property somebody holds.
                  return position.assetType === one && position.kind === 'asset';
                }}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
