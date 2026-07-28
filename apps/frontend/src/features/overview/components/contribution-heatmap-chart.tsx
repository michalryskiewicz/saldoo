import { ScatterChart, Scatter, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import '@/index.css';

import i18n, { type TranslationKey } from '@/i18n.ts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart.tsx';
import { formatDate, formatDay, formatMonth } from '@/lib/formats.ts';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { ChartEmptyOverlay } from '@/components/stats/empty-state.tsx';
import { paths } from '@/routes/paths.ts';

const chartConfig = {
  total: {
    label: i18n.t('total'),
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export default function ContributionHeatmap() {
  const { contributionData, hasTransactions } = useOverviewData();

  const isEmpty = !hasTransactions;

  const colorScale = (v: number) => {
    if (v === 0) return '#e5e7eb'; // gray-200
    if (v < 5) return '#fef3c7'; // orange-200
    if (v < 10) return 'var(--chart-1)'; // orange-400
    return '#c2410c'; // orange-800
  };

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>{i18n.t('metrics.activity_chart')}</CardTitle>
        <CardDescription>{i18n.t('metrics.activity_chart_description')}</CardDescription>
      </CardHeader>

      <CardContent className="pb-0 relative">
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
          className={`mx-auto aspect-square max-h-[150px] w-full ${isEmpty ? 'opacity-30' : ''}`}
        >
          <div className="overflow-x-auto px-4 hide-scrollbar">
            <div className="w-[1000px] mx-auto">
              <ScatterChart
                width={1000}
                height={150}
                margin={{
                  top: -20,
                  right: -150,
                  bottom: 20,
                  left: 20,
                }}
              >
                <XAxis
                  type="number"
                  dataKey="week"
                  tickLine={true}
                  axisLine={false}
                  tickMargin={20}
                  interval={0}
                  tickFormatter={(value: TranslationKey) =>
                    formatMonth(value, { type: 'short', locale: 'pl' })
                  }
                />
                <YAxis
                  type="number"
                  dataKey="day"
                  tickLine={true}
                  axisLine={false}
                  tickMargin={20}
                  tickFormatter={(value: TranslationKey) => {
                    switch (value?.toString()) {
                      case '0':
                      case '2':
                      case '4':
                        return formatDay(value, { type: 'short', locale: 'pl' });
                      case '8':
                        return formatDay(6, { type: 'short', locale: 'pl' });
                      default:
                        return '-';
                    }
                  }}
                />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(_value, name, item, index) => {
                        if (index !== 1) {
                          return null;
                        }

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
                            {i18n.t(
                              // Built from chart series names at runtime, so the key
                              // cannot be narrowed to the translation union here.
                              `metrics.${chartConfig[name as keyof typeof chartConfig]?.label || name}` as TranslationKey
                            )}
                            <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                              {formatDate(
                                new Date(item.payload.year, item.payload.month, item.payload.date)
                              )}
                            </div>

                            {index === 1 && (
                              <>
                                <div className="text-foreground mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium">
                                  Ilość transakcji
                                  {/*{i18n.t('Transakcje')}*/}
                                  <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                                    {item.payload.value}
                                  </div>
                                </div>
                                {/*<div className="text-foreground  flex basis-full items-center text-xs font-medium">*/}
                                {/*  {i18n.t('Kwota transakcji')}*/}
                                {/*  <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">*/}
                                {/*    {item.payload.amount}*/}
                                {/*  </div>*/}
                                {/*</div>*/}
                              </>
                            )}
                          </>
                        );
                      }}
                    />
                  }
                />
                <Scatter
                  dataKey="value"
                  data={contributionData}
                  shape={(props: unknown) => {
                    // Recharts types customised shapes as receiving `unknown`.
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: { value: number };
                    };
                    return (
                      <rect
                        x={cx - 6}
                        y={cy - 6}
                        width={12}
                        height={12}
                        rx={2}
                        ry={2}
                        fill={colorScale(payload.value)}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </div>
          </div>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
