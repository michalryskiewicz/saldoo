import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart.tsx';
import { formatMoneyValue } from '@/lib/formats.ts';
import { useBondSeries } from '@/features/net-worth/hooks/use-bond-series.tsx';
import i18n from '@/i18n.ts';

/**
 * Interest is a profit, so it wears the profit series colour the rest of the app uses for one.
 * Capital means nothing in particular — it is the money that was put in — so it takes a chart ramp
 * colour rather than a token that says something.
 */
const chartConfig = {
  capital: {
    label: i18n.t('bonds.capital'),
    color: 'var(--chart-3)',
  },
  interest: {
    label: i18n.t('bonds.interest_earned'),
    color: 'var(--series-profit)',
  },
} satisfies ChartConfig;

/**
 * What the holdings are made of, month by month, and what the same arithmetic says about the years
 * ahead.
 *
 * The projection is drawn rather than described because that is the shape of the answer: a person
 * asking whether these bonds will carry a goal is asking about a curve. What keeps it honest is
 * that the future half is shaded and labelled, and the description says the rate is known for one
 * period only.
 */
export const BondsChart = () => {
  const { rows, currency, excluded, projectionFrom } = useBondSeries();

  if (rows.length === 0) return null;

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>{i18n.t('bonds.chart_title')}</CardTitle>
          <CardDescription>
            {i18n.t('bonds.chart_description')}
            {excluded > 0 && ` ${i18n.t('bonds.chart_other_currency', { excluded })}`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          {/* Room on the right for the last year's label: without it the axis ends on a half-drawn
              "20" and the chart looks like it stops mid-decade. */}
          <AreaChart accessibilityLayer data={rows} margin={{ top: 20, right: 24 }}>
            <CartesianGrid vertical={false} />
            <YAxis
              tickLine={true}
              axisLine={false}
              tickFormatter={(value) => formatMoneyValue(value, currency)}
              width={90}
            />
            {/* One tick a year. Every month labelled would be a hundred and thirty overlapping
                labels, and the month is not the question a ten-year chart answers. */}
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              interval={11}
              tickFormatter={(value: string) => value.slice(0, 4)}
            />

            {projectionFrom && (
              <>
                <ReferenceArea
                  x1={projectionFrom}
                  x2={rows.at(-1)!.label}
                  fill="var(--muted-foreground)"
                  fillOpacity={0.08}
                  // At the start of the band, beside the dashed line, because that is where the
                  // word applies from. Pinned to the far right it read as a label for the last
                  // year rather than for everything after today.
                  label={{
                    value: i18n.t('bonds.projection'),
                    position: 'insideTopLeft',
                    fill: 'var(--muted-foreground)',
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  x={projectionFrom}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                />
              </>
            )}

            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label: string) => label}
                  formatter={(value, name) => (
                    <div className="flex w-full justify-between gap-3">
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium">
                        {formatMoneyValue(value, currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />

            {/* Stacked, and capital first: the interest is what sits on top of the money that was
                put in, which is the thing being looked for. */}
            <Area
              dataKey="capital"
              type="stepAfter"
              stackId="worth"
              stroke="var(--color-capital)"
              fill="var(--color-capital)"
              fillOpacity={0.5}
            />
            <Area
              dataKey="interest"
              type="stepAfter"
              stackId="worth"
              stroke="var(--color-interest)"
              fill="var(--color-interest)"
              fillOpacity={0.5}
            />

            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
