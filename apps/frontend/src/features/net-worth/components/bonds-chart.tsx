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
import { formatAxisMoney, formatMoneyValue } from '@/lib/formats.ts';
import { ChartTooltipRow } from '@/components/stats/chart-tooltip-row.tsx';
import {
  DEFAULT_HORIZON_YEARS,
  useBondSeries,
} from '@/features/net-worth/hooks/use-bond-series.tsx';
import { cn } from '@/lib/utils.ts';
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

type SegmentProps = { pressed: boolean; onClick: () => void; children: string };

/**
 * One half of a two-way choice, drawn as a segment rather than as a loose button.
 *
 * Three separate buttons in a row read as three unrelated commands — and two of these are one
 * question with two answers. Sitting them in a single bordered track says "pick one" without a
 * word of label.
 */
const Segment = ({ pressed, onClick, children }: SegmentProps) => (
  <Button
    type="button"
    size="sm"
    variant="ghost"
    aria-pressed={pressed}
    onClick={onClick}
    className={cn(
      'h-7 rounded-sm px-3 text-xs font-normal',
      pressed && 'bg-background text-foreground shadow-xs'
    )}
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
  const [afterTax, setAfterTax] = useState(false);
  const [years, setYears] = useState(DEFAULT_HORIZON_YEARS);
  const {
    rows,
    currency,
    excluded,
    projectionFrom,
    wrappers,
    yearsToLastMaturity,
    maturities,
  } = useBondSeries(years);

  if (rows.length === 0) return null;

  const horizon = Math.min(years, yearsToLastMaturity);
  const lastDrawn = rows.at(-1)!.label.slice(0, 4);

  // Only the redemptions that fall inside what is drawn: a marker for a date off the right-hand
  // edge is a line nobody can see and a label the axis has no room for.
  const marked = maturities.filter((one) => one.label <= rows.at(-1)!.label);

  // Every treatment actually in play, counted. "After tax" on its own says nothing about *which*
  // tax, and the three here work on different principles rather than at different rates.
  const treatments = [
    wrappers.none > 0 && i18n.t('bonds.tax_ordinary', { count: wrappers.none }),
    wrappers.IKE > 0 && i18n.t('bonds.tax_ike', { count: wrappers.IKE }),
    wrappers.IKZE > 0 && i18n.t('bonds.tax_ikze', { count: wrappers.IKZE }),
  ].filter(Boolean);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>{i18n.t('bonds.chart_title')}</CardTitle>
          <CardDescription>
            {i18n.t('bonds.chart_description')}
            {excluded > 0 && ` ${i18n.t('bonds.chart_other_currency', { excluded })}`}
          </CardDescription>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div
              role="group"
              aria-label={i18n.t('bonds.tax_view')}
              className="bg-muted inline-flex gap-1 rounded-md p-1"
            >
              <Segment pressed={!afterTax} onClick={() => setAfterTax(false)}>
                {i18n.t('bonds.gross')}
              </Segment>
              <Segment pressed={afterTax} onClick={() => setAfterTax(true)}>
                {i18n.t('bonds.after_tax')}
              </Segment>
            </div>

            {/* A native range, so it is keyboard-steerable and needs no dependency. Nought means
                "only what has happened", which is the projection switch this replaces. */}
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              {i18n.t('bonds.horizon')}
              <input
                type="range"
                min={0}
                max={Math.max(1, yearsToLastMaturity)}
                step={1}
                value={horizon}
                onChange={(event) => setYears(Number(event.target.value))}
                className="accent-primary w-32"
                aria-valuetext={i18n.t('bonds.horizon_years', { count: horizon })}
              />
              <span className="text-foreground tabular-nums">
                {horizon === 0
                  ? i18n.t('bonds.horizon_none')
                  : i18n.t('bonds.horizon_to', {
                      count: horizon,
                      year: lastDrawn,
                    })}
              </span>
            </label>
          </div>

          {/* Which tax, on how many holdings — "after tax" alone leaves the reader guessing. */}
          <p className="text-muted-foreground text-xs">{treatments.join(' · ')}</p>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          {/* Room on the right for the last year's label: without it the axis ends on a half-drawn
              "20" and the chart looks like it stops mid-decade. */}
          <LineChart accessibilityLayer data={rows} margin={{ top: 20, right: 24 }}>
            <CartesianGrid vertical={false} />
            {/* Whole złoty on the ticks, and a tenth of the range kept free above the highest
                point: the value line used to run along the very top edge, through the labels that
                sit there. Exact figures are the tooltip's job. */}
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatAxisMoney(value, currency)}
              domain={[0, (max: number) => Math.ceil((max * 1.12) / 1000) * 1000]}
              width={78}
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

            {marked.map((one) => (
              <ReferenceLine
                key={`${one.label}-${one.name}`}
                x={one.label}
                stroke="var(--muted-foreground)"
                strokeDasharray="2 4"
                // At the foot of the plot, where there is nothing to collide with. Along the top
                // they shared a line with the projection's own label and with the value curve.
                label={{
                  value: one.name,
                  position: 'insideBottomRight',
                  fill: 'var(--muted-foreground)',
                  fontSize: 10,
                }}
              />
            ))}

            {projectionFrom && horizon > 0 && (
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
