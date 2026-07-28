import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { formatMonth, formatNumber } from '@/lib/formats.ts';
import { useIsMobile } from '@/hooks/use-mobile.ts';
import { Link } from 'react-router';
import { paths } from '@/routes/paths.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { ChartEmptyOverlay } from '@/components/stats/empty-state.tsx';

const chartConfig = {
  totalProfits: {
    label: i18n.t('metrics.totalProfits'),
    color: 'var(--chart-2)',
  },
  totalExpense: {
    label: i18n.t('metrics.totalExpense'),
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const data = useOverviewData();
  const isMobile = useIsMobile();

  const isEmpty = !data?.hasExpenses && !data?.hasProfits;

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{i18n.t('expenses_to_profit_area_title')}</CardTitle>
          <CardDescription>
            {i18n.t('expenses_chart_description')}{' '}
            <Link to={paths.account.root} className="underline">
              {i18n.t('here_to_link')}
            </Link>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 relative">
        {isEmpty && (
          <ChartEmptyOverlay
            icon={LineChartIcon}
            description={i18n.t('empty_state.no_yearly_data')}
            ctaLabel={i18n.t('empty_state.add_first_profit')}
            ctaTo={paths.dashboard.profits}
          />
        )}
        <ChartContainer
          config={chartConfig}
          className={`aspect-auto h-[250px] w-full ${isEmpty ? 'opacity-30' : ''}`}
        >
          <LineChart
            reverseStackOrder
            accessibilityLayer
            data={data?.chartData}
            margin={{
              right: 20,
            }}
          >
            <YAxis tickLine={true} axisLine={false} />
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={true}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: TranslationKey) =>
                formatMonth(value, { type: isMobile ? 'short' : 'long', locale: 'pl' })
              }
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
                            {data?.settings?.currency || ''}
                          </span>
                        </div>
                        {/* Add this after the last item */}
                        {index === 1 && (
                          <div className="text-foreground mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium">
                            {i18n.t('total')}
                            <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                              {formatNumber(item.payload.totalProfits - item.payload.totalExpense)}
                              <span className="text-muted-foreground font-normal">
                                {data?.settings?.currency || ''}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }}
                />
              }
              cursor={false}
              defaultIndex={1}
            />
            <Line
              dataKey="totalExpense"
              type="monotone"
              stroke="var(--color-totalExpense)"
              strokeWidth={2}
              fill="ulr(#fillMobile)"
              dot={{
                fill: 'var(--color-totalExpense)',
              }}
              activeDot={{
                r: 6,
              }}
            />
            <Line
              dataKey="totalProfits"
              type="monotone"
              stroke="var(--color-totalProfits)"
              fill="ulr(#fillDesktop)"
              strokeWidth={2}
              dot={{
                fill: 'var(--color-totalProfits)',
              }}
              activeDot={{
                r: 6,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
