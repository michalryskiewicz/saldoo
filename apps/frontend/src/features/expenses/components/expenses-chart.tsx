import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart.tsx';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { useState } from 'react';
import { formatMonth } from '@/lib/formats.ts';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useSidebar } from '@/components/ui/sidebar.tsx';
import { paths } from '@/routes/paths';
import i18n from '@/i18n.ts';
import { Link } from 'react-router';

import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';

/**
 * Severity keeps the colours it has in the table.
 *
 * These three bars are the same fact the priority column states, so reaching into the chart
 * ramp for them said "low" in green in one place and in teal in the other. The ramp is for
 * series that mean nothing in particular; severity means something, and it already has tokens.
 *
 * `total` is not a severity, so it stays a chart colour.
 */
const chartConfig = {
  total: {
    label: i18n.t('metrics.totalExpense'),
    color: 'var(--chart-3)',
  },
  high: {
    label: i18n.t('metrics.HIGH'),
    color: 'var(--severity-high)',
  },
  medium: {
    label: i18n.t('metrics.MEDIUM'),
    color: 'var(--severity-medium)',
  },
  low: {
    label: i18n.t('metrics.LOW'),
    color: 'var(--severity-low)',
  },
} satisfies ChartConfig;

export const ExpensesChart = () => {
  const { chartData } = useListExpenses();
  const { settings } = useSettings();
  const { isMobile } = useSidebar();

  const [chartDisplay, setChartDisplay] = useState<'total' | 'severity'>('total');

  return (
    <>
      <div className="flex">
        <Tabs defaultValue={chartDisplay}>
          <TabsList>
            <TabsTrigger value="total" onClick={() => setChartDisplay('total')}>
              {i18n.t('total')}
            </TabsTrigger>
            <TabsTrigger value="severity" onClick={() => setChartDisplay('severity')}>
              {i18n.t('by_severity')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Card className="py-0">
        <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 ">
            <CardTitle>{i18n.t('expenses_chart_title')}</CardTitle>
            <CardDescription>
              {i18n.t('expenses_chart_description')}{' '}
              <Link to={paths.account.root} className="underline">
                {i18n.t('here_to_link')}
              </Link>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:p-6">
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                top: 30,
              }}
            >
              <CartesianGrid vertical={false} />
              <YAxis tickLine={true} axisLine={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  return formatMonth(value, { type: isMobile ? 'short' : 'long', locale: 'pl' });
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="w-[180px]"
                    formatter={(value, name, item, index) => {
                      return (
                        <>
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
                            style={
                              {
                                '--color-bg': `var(--color-${name})`,
                              } as React.CSSProperties
                            }
                          />
                          {chartConfig[name as keyof typeof chartConfig]?.label || name}
                          <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                            {value}
                            <span className="text-muted-foreground font-normal">
                              {settings?.currency || ''}
                            </span>
                          </div>
                          {/* Add this after the last item */}
                          {index === 2 && (
                            <div className="text-foreground mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium">
                              {i18n.t('total')}
                              <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                                {item.payload.total}
                                <span className="text-muted-foreground font-normal">
                                  {settings?.currency || ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    }}
                  />
                }
              />
              {chartDisplay === 'total' ? (
                <Bar dataKey="total" stackId="a" fill="var(--color-total)" radius={4} />
              ) : (
                <>
                  <Bar dataKey="high" stackId="a" fill="var(--color-high)" radius={4} />
                  <Bar dataKey="medium" stackId="a" fill="var(--color-medium)" radius={4} />
                  <Bar dataKey="low" stackId="a" fill="var(--color-low)" radius={4} />
                </>
              )}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
};
