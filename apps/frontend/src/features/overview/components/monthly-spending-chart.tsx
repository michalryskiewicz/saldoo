import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Activity } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import i18n from '@/i18n.ts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart.tsx';
import { formatMoney, formatMoneyValue } from '@/lib/formats.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { ChartEmptyOverlay } from '@/components/stats/empty-state.tsx';
import { paths } from '@/routes/paths.ts';
import { peakSpendingDay } from '@/lib/monthly-spending.ts';

const chartConfig = {
  spent: {
    label: i18n.t('metrics.totalExpense'),
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

/**
 * When money left the account this month, one bar per day.
 *
 * It replaces a year-long heatmap of 53 columns whose x axis formatted a week number as a month,
 * whose empty cells were a hardcoded near-white — a wall of white squares in the dark theme —
 * and which was laid out at a fixed 1000px inside a horizontal scroller, so a phone showed about
 * a quarter of it. A month of days fits the card it lives in at both widths, and the day worth
 * knowing about is named underneath in words rather than left to be picked out of a grid.
 */
export default function MonthlySpendingChart() {
  const { monthlySpending, currency, hasTransactions } = useOverviewData();

  const isEmpty = !hasTransactions;
  const peak = peakSpendingDay(monthlySpending);

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>{i18n.t('monthly_spending_title')}</CardTitle>
        <CardDescription>{i18n.t('monthly_spending_description')}</CardDescription>
      </CardHeader>

      <CardContent className="relative pb-0">
        {isEmpty && (
          <ChartEmptyOverlay
            icon={Activity}
            description={i18n.t('empty_state.no_activity_data')}
            ctaLabel={i18n.t('empty_state.add_first_transaction')}
            ctaTo={paths.dashboard.transactions}
          />
        )}
        <ChartContainer
          config={chartConfig}
          className={`h-[150px] w-full ${isEmpty ? 'opacity-30' : ''}`}
        >
          <BarChart accessibilityLayer data={monthlySpending} margin={{ top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              // Every fifth day. A tick per day is 31 numbers in the width of a half-card, which
              // is a grey smear rather than a scale.
              interval={4}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(day) => i18n.t('monthly_spending_day', { day })}
                  formatter={(value) => (
                    <div className="text-muted-foreground flex min-w-[130px] items-center gap-1 text-xs">
                      {chartConfig.spent.label}
                      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                        {formatMoneyValue(value, currency)}
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="spent" fill="var(--color-spent)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="text-sm">
        <div className="leading-none font-medium">
          {peak
            ? i18n.t('monthly_spending_peak', {
                day: peak.day,
                amount: formatMoney(peak.spent, currency),
              })
            : i18n.t('monthly_spending_none')}
        </div>
      </CardFooter>
    </Card>
  );
}
