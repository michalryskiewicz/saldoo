import { Coins } from 'lucide-react';
import { Link } from 'react-router';

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

type PartProps = {
  label: string;
  /** The screen this part of the figure is authored on. */
  to: string;
  value: string;
  /** Said beside the link rather than inside it, so the link is named by the part alone. */
  note?: string;
};

const Part = ({ label, to, value, note }: PartProps) => (
  <div className="flex gap-1">
    <dt>
      <Link to={to} className="hover:text-foreground underline-offset-4 hover:underline">
        {label}
      </Link>
      {note ? ` (${note})` : ''}:
    </dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);

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

            {/* Each part is the way to the screen that authors it: the figure is joined from four
                tables nobody can see from here, and a link answers "where is that from" without a
                sentence that would go stale. */}
            <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Part
                label={i18n.t('free_this_month.planned_income')}
                to={paths.dashboard.profits}
                value={formatMoney(freeThisMonth.plannedIncome, currency)}
              />
              <Part
                label={i18n.t('free_this_month.spent')}
                to={paths.dashboard.transactions}
                value={formatMoney(freeThisMonth.spent, currency)}
              />
              <Part
                label={i18n.t('free_this_month.owed')}
                note={owedLabel}
                to={paths.dashboard.duties}
                value={formatMoney(freeThisMonth.owed, currency)}
              />
              <Part
                label={i18n.t('free_this_month.goals')}
                to={paths.dashboard.goals}
                value={formatMoney(freeThisMonth.goalsToFund, currency)}
              />
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
