import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import { formatMoney, formatMoneyValue } from '@/lib/formats.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';
import { formatValuationAge } from '@/features/net-worth/services/valuation-age.service.ts';
import type { Segment } from '@/features/net-worth/services/net-worth-breakdown.service.ts';
import i18n from '@/i18n.ts';

/**
 * Two ramps, one per side, and they do not meet.
 *
 * A single ramp put the same orange at the end of what is held and across what is owed, and two
 * blocks of one colour on one chart read as one thing however far apart they sit. Which particular
 * account or debt a block is means nothing in particular — that is what the ramp is for — but
 * *which side it is on* is the whole question the chart answers, so the sides are told apart by
 * temperature and never share a hue.
 */
const HELD = ['var(--chart-3)', 'var(--chart-2)', 'var(--chart-7)', 'var(--chart-6)'];
const OWED = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-5)'];

const configOf = (segments: Segment[], ramp: string[]): ChartConfig =>
  Object.fromEntries(
    segments.map((segment, index) => [
      segment.key,
      { label: segment.label, color: ramp[index % ramp.length] },
    ])
  );

/**
 * The whole picture on one scale: what is held above what is owed.
 *
 * **Two bars rather than a ring.** The question is a comparison of two totals before it is a
 * question about composition, and a ring cannot compare two totals — it can only divide one. On a
 * shared axis the answer is the length of the bars, and the make-up of each is there without being
 * asked for.
 *
 * **A snapshot, said out loud in the description.** A position carries the one valuation somebody
 * last gave it, so there is no history to draw and drawing one would be inventing it. The bonds are
 * the exception and have their own chart, where the arithmetic makes a history real.
 */
export const NetWorthChart = () => {
  const { breakdown, currency, valuedOn, positions, bonds } = useNetWorth();

  if (!positions.length && !bonds.length) return null;

  const chartConfig = {
    ...configOf(breakdown.held, HELD),
    ...configOf(breakdown.owed, OWED),
  } satisfies ChartConfig;

  const rows = [
    {
      side: i18n.t('holdings.held'),
      ...Object.fromEntries(breakdown.held.map((segment) => [segment.key, segment.value])),
    },
    {
      side: i18n.t('holdings.owed'),
      ...Object.fromEntries(breakdown.owed.map((segment) => [segment.key, segment.value])),
    },
  ];

  const segments = [...breakdown.held, ...breakdown.owed];

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>{i18n.t('holdings.net_worth')}</CardTitle>
          <CardDescription>
            {i18n.t('holdings.breakdown_description')} {formatValuationAge(valuedOn)}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-2 pt-4 pb-6 sm:p-6">
        {/* The answer, before the picture of it. Somebody who wants the number should not have to
            read two bars to get it. */}
        <span className="px-4 text-3xl font-semibold tabular-nums sm:px-0" data-slot="net-worth-total">
          {formatMoney(breakdown.totals.net, currency)}
        </span>

        <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
          <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 24 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={(value) => formatMoneyValue(value, currency)} />
            <YAxis type="category" dataKey="side" tickLine={false} axisLine={false} width={100} />

            <ChartTooltip
              content={
                <ChartTooltipContent
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

            {segments.map((segment) => (
              <Bar
                key={segment.key}
                dataKey={segment.key}
                stackId="side"
                fill={`var(--color-${segment.key})`}
                radius={2}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
