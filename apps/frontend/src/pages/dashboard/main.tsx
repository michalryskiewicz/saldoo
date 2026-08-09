import { ChartAreaInteractive } from '@/features/overview/components/expenses-to-profit-area-chart';
import { ExpensesByCategoryChart } from '@/features/overview/components/categories-in-expenses-chart.tsx';

import { BudgetingStrategyCards } from '@/features/overview/components/budgeting-strategy-cards.tsx';
import { FreeThisMonthCard } from '@/features/overview/components/free-this-month-card.tsx';
import { FinancialSafetyNetCard } from '@/features/overview/components/financial-safety-net-card.tsx';
import { NetWorthCard } from '@/features/net-worth/components/net-worth-card.tsx';
import MonthlySpendingChart from '@/features/overview/components/monthly-spending-chart.tsx';
import { SetUpPersonalPreferencesIndicator } from '@/components/set-up-personal-preferences-indicator.tsx';
import { ContentSkeleton } from '@/components/loaders/content-skeleton.tsx';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { PageHeader } from '@/components/page-header.tsx';
import i18n from '@/i18n.ts';

export default function Page() {
  const { settings, isLoading } = useOverviewData();

  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (!settings?.currency || !settings?.strategy) {
    return <SetUpPersonalPreferencesIndicator />;
  }

  return (
    <>
      {/* No action of its own: everything here is read, and every figure on it is authored on
          another screen. */}
      <PageHeader title={i18n.t('dashboard')} description={i18n.t('dashboard_subtitle')} />

      {/* First, because it is the only figure here somebody can act on today: everything below it
          describes a month that has already happened. */}
      <FreeThisMonthCard />

      <BudgetingStrategyCards />

      <ChartAreaInteractive />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 h-fit">
        <ExpensesByCategoryChart />
        <div className="h-full gap-4 flex flex-col w-full">
          <NetWorthCard />
          <FinancialSafetyNetCard />
          <MonthlySpendingChart />
        </div>
      </div>
    </>
  );
}
