import { BUDGETING_STRATEGIES } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatMoney } from '@/lib/formats.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { MetricCard } from '@/components/stats/metric-card.tsx';
import { cn } from '@/lib/utils.ts';
import { MetricWithCircularProgress } from '@/components/stats/metric-with-circular-progress.tsx';

export const BudgetingStrategyCards = () => {
  const data = useOverviewData();

  if (!data?.profile?.strategy) {
    return null;
  }

  const strategyItems = BUDGETING_STRATEGIES[data?.profile.strategy] || [];

  return (
    <div className={cn(`w-full grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4`)}>
      <MetricWithCircularProgress
        title={i18n.t('this_month_you_have_left')}
        progress={Math.round(((data?.totalExpense || 0) / (data?.totalProfits || 1)) * 100)}
        budget={formatMoney(data?.totalProfits || 0, data?.currency || 'EUR')}
        current={formatMoney(data?.totalExpense || 0, data?.currency || 'EUR')}
        totalLeft={formatMoney(data?.savings || 0, data?.currency || 'EUR')}
        fill={'var(--chart-4)'}
      />
      {strategyItems?.map((s) => {
        const budgetPlannedSpent = (data?.totalProfits || 0) * (s?.expanses / 100);

        const plannedSpent =
          data?.expensesByStrategyPart?.find((e) => e.strategyPart === s.type)?.planned || 0;

        const realSpent =
          data?.expensesByStrategyPart?.find((e) => e.strategyPart === s.type)?.real || 0;

        const realPercentageSpent = Number((realSpent / budgetPlannedSpent) * 100);

        return (
          <MetricCard
            key={s.type}
            title={i18n.t(s.type as TranslationKey)}
            value={formatMoney(realSpent, data?.currency || 'EUR')}
            limit={formatMoney(budgetPlannedSpent, data?.currency || 'EUR')}
            percentage={realPercentageSpent}
            progressColor="bg-blue-500"
            details={[
              {
                label: i18n.t('metrics.planned'),
                value: formatMoney(plannedSpent, data?.currency || 'EUR'),
                color: 'bg-gray-500',
              },
            ]}
          />
        );
      })}
    </div>
  );
};
