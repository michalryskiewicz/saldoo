import { Sparkles } from 'lucide-react';

import { BUDGETING_STRATEGIES } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatMoney } from '@/lib/formats.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { MetricCard } from '@/components/stats/metric-card.tsx';
import { cn } from '@/lib/utils.ts';
import { MetricWithCircularProgress } from '@/components/stats/metric-with-circular-progress.tsx';
import { paths } from '@/routes/paths.ts';

const LG_COLS_BY_COUNT: Record<number, string> = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

export const BudgetingStrategyCards = () => {
  const data = useOverviewData();

  if (!data?.settings?.strategy) {
    return null;
  }

  const strategyItems = BUDGETING_STRATEGIES[data?.settings.strategy] || [];
  const totalProfits = data?.totalProfits || 0;
  const totalExpense = data?.totalExpense || 0;
  // Empty = no records exist at all, not "current month rolls up to zero".
  // YEARLY/edge-case expenses can sit in DB without contributing to this month.
  const isOverviewEmpty = !data?.hasExpenses && !data?.hasProfits;
  const currency = data?.currency || 'EUR';

  // Total cards = main "left this month" + strategy parts. Clamped to 3..5 → one row on lg.
  const totalCards = 1 + strategyItems.length;
  const lgCols = LG_COLS_BY_COUNT[totalCards] ?? 'lg:grid-cols-4';

  // Same empty-state shape across every top card (no per-type differentiation yet).
  const sharedEmptyProps = {
    isEmpty: isOverviewEmpty,
    emptyIcon: Sparkles,
    emptyDescription: i18n.t('empty_state.no_strategy_data'),
    emptyCtaLabel: i18n.t('empty_state.add_first_expense'),
    emptyCtaTo: paths.dashboard.expenses,
  } as const;

  return (
    <div className={cn('w-full grid gap-4 grid-cols-1 sm:grid-cols-2', lgCols)}>
      <MetricWithCircularProgress
        title={i18n.t('this_month_you_have_left')}
        progress={totalProfits > 0 ? Math.round((totalExpense / totalProfits) * 100) : 0}
        budget={formatMoney(totalProfits, currency)}
        current={formatMoney(totalExpense, currency)}
        totalLeft={formatMoney(data?.savings || 0, currency)}
        fill={'var(--chart-4)'}
        {...sharedEmptyProps}
      />
      {strategyItems?.map((s) => {
        const budgetPlannedSpent = totalProfits * (s?.expanses / 100);
        const plannedSpent =
          data?.expensesByStrategyPart?.find((e) => e.strategyPart === s.type)?.planned || 0;
        const realSpent =
          data?.expensesByStrategyPart?.find((e) => e.strategyPart === s.type)?.real || 0;
        const realPercentageSpent =
          budgetPlannedSpent > 0 ? Number((realSpent / budgetPlannedSpent) * 100) : 0;

        const isPartEmpty =
          isOverviewEmpty || (budgetPlannedSpent === 0 && plannedSpent === 0 && realSpent === 0);

        return (
          <MetricCard
            key={s.type}
            title={i18n.t(s.type as TranslationKey)}
            value={formatMoney(realSpent, currency)}
            limit={formatMoney(budgetPlannedSpent, currency)}
            percentage={realPercentageSpent}
            progressColor="bg-info"
            details={[
              {
                label: i18n.t('metrics.planned'),
                value: formatMoney(plannedSpent, currency),
                color: 'bg-muted-foreground',
              },
            ]}
            isEmpty={isPartEmpty}
            emptyIcon={sharedEmptyProps.emptyIcon}
            emptyDescription={sharedEmptyProps.emptyDescription}
            emptyCtaLabel={sharedEmptyProps.emptyCtaLabel}
            emptyCtaTo={sharedEmptyProps.emptyCtaTo}
          />
        );
      })}
    </div>
  );
};
