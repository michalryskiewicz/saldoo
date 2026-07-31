import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import { PieChart } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatMoney, formatMonth, formatMoneyValue } from '@/lib/formats.ts';
import i18n from '@/i18n';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { paths } from '@/routes/paths.ts';

const chartConfig = {
  total: {
    label: i18n.t('total'),
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function ChartRadarDots() {
  const data = useOverviewData();

  const radialChart = data?.radialChart ?? [];
  const maxItem = data?.maxRadialChartItem;
  // No expenses at all → empty. Otherwise still empty if no tagged expense rolls into the chart
  // (e.g. all expenses are YEARLY in another month, or untagged).
  const isEmpty = !data?.hasExpenses || !radialChart.length || !maxItem?.tag;

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>{i18n.t('distribution_of_expenses')}</CardTitle>
        <CardDescription>{i18n.t('distribution_of_expenses_description')}</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        {isEmpty ? (
          <div className="mx-auto aspect-square max-h-[250px] w-full flex items-center justify-center">
            <EmptyState
              icon={PieChart}
              description={i18n.t('empty_state.no_categories_data')}
              ctaLabel={i18n.t('empty_state.add_first_expense')}
              ctaTo={paths.dashboard.expenses}
            />
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[250px] w-full"
          >
            <RadarChart
              data={radialChart}
              margin={{
                top: 30,
                bottom: 30,
                left: 30,
                right: 30,
              }}
            >
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => {
                      return (
                        <div className="text-muted-foreground flex min-w-[130px] items-center text-xs gap-1">
                          {chartConfig[name as keyof typeof chartConfig]?.label || name}
                          <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                            {formatMoneyValue(value, data?.settings?.currency)}
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <PolarAngleAxis dataKey="tag" />
              <PolarGrid />
              <Radar
                dataKey="total"
                fill="var(--color-total)"
                fillOpacity={0.6}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                }}
              />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          {isEmpty
            ? i18n.t('empty_state.no_dominant_expense')
            : `${i18n.t('maximum_expense')} ${maxItem!.tag} (${formatMoney(maxItem!.total || 0, data?.settings?.currency ?? 'PLN')})`}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 leading-none">
          {`${formatMonth(new Date().getMonth())} ${new Date().getFullYear()}`}
        </div>
      </CardFooter>
    </Card>
  );
}
