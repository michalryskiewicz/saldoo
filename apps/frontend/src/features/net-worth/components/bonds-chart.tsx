import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button.tsx';
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
import { ChartTooltipRow } from '@/components/stats/chart-tooltip-row.tsx';
import { useBondSeries } from '@/features/net-worth/hooks/use-bond-series.tsx';
import i18n from '@/i18n.ts';

/**
 * What the bonds are worth wears the profit series colour: the distance between it and the capital
 * line *is* the profit. Capital means nothing in particular — it is the money that was put in — so
 * it takes a chart ramp colour rather than a token that says something.
 */
const chartConfig = {
  worth: {
    label: i18n.t('bonds.worth'),
    color: 'var(--series-profit)',
  },
  net: {
    label: i18n.t('bonds.after_tax'),
    color: 'var(--series-profit)',
  },
  capital: {
    label: i18n.t('bonds.capital'),
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

type SwitchProps = { pressed: boolean; onClick: () => void; children: string };

/** A pressed-state button rather than a checkbox: it changes what is drawn, it does not collect a value. */
const ChartSwitch = ({ pressed, onClick, children }: SwitchProps) => (
  <Button
    type="button"
    size="sm"
    variant={pressed ? 'secondary' : 'ghost'}
    aria-pressed={pressed}
    onClick={onClick}
  >
    {children}
  </Button>
);

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
  const [afterTax, setAfterTax] = useState(false);
  const [withProjection, setWithProjection] = useState(true);

  if (rows.length === 0) return null;

  // Labels are `YYYY-MM`, so "before the first projected month" is a string comparison and needs no
  // second date library on the render path.
  const visible =
    withProjection || !projectionFrom ? rows : rows.filter((row) => row.label < projectionFrom);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>{i18n.t('bonds.chart_title')}</CardTitle>
          <CardDescription>
            {i18n.t('bonds.chart_description')}
            {excluded > 0 && ` ${i18n.t('bonds.chart_other_currency', { excluded })}`}
          </CardDescription>

          <div className="flex flex-wrap gap-2 pt-1">
            <ChartSwitch pressed={!afterTax} onClick={() => setAfterTax(false)}>
              {i18n.t('bonds.gross')}
            </ChartSwitch>
            <ChartSwitch pressed={afterTax} onClick={() => setAfterTax(true)}>
              {i18n.t('bonds.after_tax')}
            </ChartSwitch>
            <ChartSwitch
              pressed={withProjection}
              onClick={() => setWithProjection((shown) => !shown)}
            >
              {i18n.t('bonds.show_projection')}
            </ChartSwitch>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          {/* Room on the right for the last year's label: without it the axis ends on a half-drawn
              "20" and the chart looks like it stops mid-decade. */}
          <LineChart accessibilityLayer data={visible} margin={{ top: 20, right: 24 }}>
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

            {projectionFrom && withProjection && (
              <>
                <ReferenceArea
                  x1={projectionFrom}
                  x2={visible.at(-1)!.label}
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
                  formatter={(value, name, item) => (
                    <ChartTooltipRow
                      color={(item as { color?: string })?.color}
                      label={String(chartConfig[name as keyof typeof chartConfig]?.label ?? name)}
                      value={formatMoneyValue(value, currency)}
                    />
                  )}
                />
              }
            />

            {/* Two lines rather than a stack, because they answer different questions and one of
                them is a staircase. What was put in only ever moves when somebody buys — hence
                `stepAfter`, which draws that as the jump it is. What it is worth climbs day by day
                on its own, so it is drawn smooth, and the gap between the two is the earnings. */}
            <Line
              dataKey="capital"
              type="stepAfter"
              stroke="var(--color-capital)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              // One line, switched: what it is worth, or what would be left of it after the tax each
              // holding's wrapper charges on the way out. Two lines at once would put the answer to
              // "how much of this is mine" on a chart that is already carrying a decade.
              dataKey={afterTax ? 'net' : 'worth'}
              type="monotone"
              stroke={afterTax ? 'var(--color-net)' : 'var(--color-worth)'}
              strokeWidth={2}
              dot={false}
            />

            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
