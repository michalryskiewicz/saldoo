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
import { formatMonth, formatMoneyValue } from '@/lib/formats.ts';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useSidebar } from '@/components/ui/sidebar.tsx';
import { paths } from '@/routes/paths';
import i18n from '@/i18n.ts';
import { Link } from 'react-router';

import { useListExpenses } from '@/features/expenses/hooks/use-list-expenses.tsx';

/**
 * Priority keeps the colours it has in the table.
 *
 * Those three bars are the same fact the priority column states, so reaching into the chart ramp
 * for them said "low" in green in one place and in teal in the other. The ramp is for series that
 * mean nothing in particular; priority means something, and it already has tokens.
 *
 * The two irreducibility bars are deliberately **not** in that family. Colour here means urgency,
 * and whether a cost can be cut is a fact rather than an alarm — reusing the priority red would
 * leave the same bar meaning something new the moment somebody switches tab.
 *
 * The *fill* tier throughout, not the mark tier: a stacked bar is a large area, and the saturation
 * that makes an 8px dot visible makes a 300px block shout. `total` is none of these, so it stays a
 * chart colour.
 */
const chartConfig = {
  total: {
    label: i18n.t('metrics.totalExpense'),
    color: 'var(--series-expense)',
  },
  high: {
    label: i18n.t('metrics.HIGH'),
    color: 'var(--severity-high-fill)',
  },
  medium: {
    label: i18n.t('metrics.MEDIUM'),
    color: 'var(--severity-medium-fill)',
  },
  low: {
    label: i18n.t('metrics.LOW'),
    color: 'var(--severity-low-fill)',
  },
  irreducible: {
    label: i18n.t('cost_nature.irreducible'),
    color: 'var(--cost-irreducible-fill)',
  },
  reducible: {
    label: i18n.t('cost_nature.reducible'),
    color: 'var(--cost-reducible-fill)',
  },
} satisfies ChartConfig;

export const ExpensesChart = () => {
  const { chartData } = useListExpenses();
  const { settings } = useSettings();
  const { isMobile } = useSidebar();

  const [chartDisplay, setChartDisplay] = useState<'total' | 'severity' | 'cost_nature'>('total');

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
            <TabsTrigger value="cost_nature" onClick={() => setChartDisplay('cost_nature')}>
              {i18n.t('by_cost_nature')}
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
                            {formatMoneyValue(value, settings?.currency)}
                          </div>
                          {/* Add this after the last item, whichever split is on show */}
                          {index === (chartDisplay === 'severity' ? 2 : 1) && (
                            <div className="text-foreground mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium">
                              {i18n.t('total')}
                              <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                                {formatMoneyValue(item.payload.total, settings?.currency)}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    }}
                  />
                }
              />
              {chartDisplay === 'total' && (
                <Bar dataKey="total" stackId="a" fill="var(--color-total)" radius={4} />
              )}
              {chartDisplay === 'severity' && (
                <>
                  <Bar dataKey="high" stackId="a" fill="var(--color-high)" radius={4} />
                  <Bar dataKey="medium" stackId="a" fill="var(--color-medium)" radius={4} />
                  <Bar dataKey="low" stackId="a" fill="var(--color-low)" radius={4} />
                </>
              )}
              {chartDisplay === 'cost_nature' && (
                <>
                  <Bar
                    dataKey="irreducible"
                    stackId="a"
                    fill="var(--color-irreducible)"
                    radius={4}
                  />
                  <Bar dataKey="reducible" stackId="a" fill="var(--color-reducible)" radius={4} />
                </>
              )}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
};
