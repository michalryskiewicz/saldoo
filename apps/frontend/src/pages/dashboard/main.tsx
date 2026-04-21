import { ChartAreaInteractive } from '@/features/overview/components/expenses-to-profit-area-chart';
import { ChartRadarDots } from '@/features/overview/components/categories-in-expenses-chart.tsx';

import { BudgetingStrategyCards } from '@/features/overview/components/budgeting-strategy-cards.tsx';
import { FinancialSafetyNetCard } from '@/features/overview/components/financial-safety-net-card.tsx';
import ContributionHeatmap from '@/features/overview/components/contribution-heatmap-chart.tsx';
import { SetUpPersonalPreferencesIndicator } from '@/components/set-up-personal-preferences-indicator.tsx';
import ContentLoading from '@/components/loaders/content-loading.tsx';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';

export default function Page() {
  const { profile, isLoading } = useOverviewData();

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!profile?.currency || !profile?.strategy) {
    return <SetUpPersonalPreferencesIndicator />;
  }

  return (
    <>
      <BudgetingStrategyCards />

      <ChartAreaInteractive />
      <div className="grid gric-cols-1 md:grid-cols-2 gap-4 h-fit">
        <ChartRadarDots />
        <div className="h-full gap-4 flex flex-col w-full">
          <FinancialSafetyNetCard />
          <ContributionHeatmap />
        </div>
      </div>
    </>
  );
}
