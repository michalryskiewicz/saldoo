import { Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { formatMoney } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import { paths } from '@/routes/paths.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';
import { formatValuationAge } from '@/features/net-worth/services/valuation-age.service.ts';

export function NetWorthCard() {
  const { totals, currency, valuedOn, positions } = useNetWorth();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{i18n.t('holdings.net_worth')}</CardTitle>
        {/* How old the figure is, said on the tile. A net worth is only as current as its stalest
            part, and one that reads as freshly true is worse than one that admits its age. */}
        <CardDescription>{formatValuationAge(valuedOn)}</CardDescription>
      </CardHeader>

      <CardContent>
        {positions.length ? (
          <div className="flex flex-col gap-3">
            <span className="text-3xl font-semibold tabular-nums" data-slot="net-worth">
              {formatMoney(totals.net, currency)}
            </span>

            <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                {i18n.t('holdings.held')}: {formatMoney(totals.held, currency)}
              </span>
              <span>
                {i18n.t('holdings.owed')}: {formatMoney(totals.owed, currency)}
              </span>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Wallet}
            description={i18n.t('holdings.empty')}
            ctaLabel={i18n.t('holdings.create')}
            ctaTo={paths.dashboard.wealth}
          />
        )}
      </CardContent>
    </Card>
  );
}
