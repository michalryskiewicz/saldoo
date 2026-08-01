import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import {
  categoriesBySize,
  categoryChartHeight,
} from '@/features/overview/services/expenses-by-category.service.ts';

/**
 * One colour for every category.
 *
 * A ramp would give each a colour of its own and say nothing by it — in this app colour means
 * urgency, and a category is not urgent. The label beside each bar carries which is which, and
 * the length carries the answer.
 */
const chartConfig = {
  total: {
    label: i18n.t('total'),
    color: 'var(--series-expense)',
  },
} satisfies ChartConfig;

export function ExpensesByCategoryChart() {
  const data = useOverviewData();

  const categories = categoriesBySize(data?.radialChart ?? []);
  const maxItem = data?.maxRadialChartItem;
  // No expenses at all → empty. Otherwise still empty if no tagged expense rolls into the chart
  // (e.g. all expenses are YEARLY in another month, or untagged).
  const isEmpty = !data?.hasExpenses || !categories.length || !maxItem?.tag;

  return (
    // Full height, so the card matches the two stacked beside it rather than stopping short and
    // leaving its own footer floating in the middle of a box.
    <Card className="h-full">
      <CardHeader className="items-center">
        <CardTitle>{i18n.t('distribution_of_expenses')}</CardTitle>
        <CardDescription>{i18n.t('distribution_of_expenses_description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center pb-0">
        {isEmpty ? (
          <div className="mx-auto flex max-h-[250px] w-full items-center justify-center py-10">
            <EmptyState
              icon={PieChart}
              description={i18n.t('empty_state.no_categories_data')}
              ctaLabel={i18n.t('empty_state.add_first_expense')}
              ctaTo={paths.dashboard.expenses}
            />
          </div>
        ) : (
          // Bars laid on their sides, which is what lets a category keep its name: a category is
          // a word of any length, and upright bars have only the width of one bar to write it in.
          // It also survives both ends of the data — the radar this replaces degenerated to a dot
          // on a stick at one category, and needs at least three axes to mean anything at all.
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: categoryChartHeight(categories.length) }}
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={categories}
              margin={{ left: 8, right: 24 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="tag"
                tickLine={false}
                axisLine={false}
                width={110}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => (
                      <div className="text-muted-foreground flex min-w-[130px] items-center gap-1 text-xs">
                        {chartConfig[name as keyof typeof chartConfig]?.label || name}
                        <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                          {formatMoneyValue(value, data?.settings?.currency)}
                        </div>
                      </div>
                    )}
                  />
                }
              />
              {/* Capped, or one category is given the whole height of the card and the bar reads
                  as a block of colour rather than a length to compare. */}
              <Bar dataKey="total" fill="var(--color-total)" radius={4} maxBarSize={28} />
            </BarChart>
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
