import { Coins } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { InfoTooltip } from '@/components/info-tooltip.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { formatMoney } from '@/lib/formats.ts';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';
import { paths } from '@/routes/paths.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';

/**
 * The one figure on the overview somebody can act on today.
 *
 * It leads the screen because everything else on it describes a month that has already happened.
 * What is free is the question a person opens the app with, and until now the nearest thing to an
 * answer was income less expenses — which reads a late bill as a good month.
 *
 * The capacity underneath is a different job and deliberately quieter: what is free swings with the
 * calendar, huge on the 3rd and nothing on the 28th, so a suggestion built on it would swing too.
 * The median of what ordinary months actually left is the figure that holds still, and it is stated
 * here so the two are never confused for one another.
 */
export function FreeThisMonthCard() {
  const { freeThisMonth, capacity, currency, hasExpenses, hasProfits } = useOverviewData();

  const isEmpty = !hasExpenses && !hasProfits;
  const owedLabel = i18n.t('free_this_month.owed_count', { count: freeThisMonth.owedCount });

  const capacityLine = () => {
    if (capacity === undefined) return i18n.t('free_this_month.capacity_unknown');

    return capacity < 0
      ? i18n.t('free_this_month.capacity_negative', {
          amount: formatMoney(Math.abs(capacity), currency),
        })
      : i18n.t('free_this_month.capacity', { amount: formatMoney(capacity, currency) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {i18n.t('free_this_month.title')}
          <InfoTooltip text={i18n.t('free_this_month.tooltip')} />
        </CardTitle>
        {!isEmpty && <CardDescription>{capacityLine()}</CardDescription>}
      </CardHeader>

      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={Coins}
            description={i18n.t('empty_state.no_strategy_data')}
            ctaLabel={i18n.t('empty_state.add_first_expense')}
            ctaTo={paths.dashboard.expenses}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <span
              data-slot="free-this-month"
              className={cn(
                'text-3xl font-semibold tabular-nums',
                freeThisMonth.free < 0 && 'text-warning'
              )}
            >
              {formatMoney(freeThisMonth.free, currency)}
            </span>

            <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1">
                <dt>{i18n.t('free_this_month.planned_income')}:</dt>
                <dd className="tabular-nums">
                  {formatMoney(freeThisMonth.plannedIncome, currency)}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>{i18n.t('free_this_month.spent')}:</dt>
                <dd className="tabular-nums">{formatMoney(freeThisMonth.spent, currency)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>
                  {i18n.t('free_this_month.owed')} ({owedLabel}):
                </dt>
                <dd className="tabular-nums">{formatMoney(freeThisMonth.owed, currency)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{i18n.t('free_this_month.goals')}:</dt>
                <dd className="tabular-nums">{formatMoney(freeThisMonth.goalsToFund, currency)}</dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
