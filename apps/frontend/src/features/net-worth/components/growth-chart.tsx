import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart.tsx';
import { formatDate, formatMoney } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';

/**
 * Whether it is growing — for the whole of it.
 *
 * Nothing answered this before. The change column answers it per holding and only against that
 * holding's own previous reading, and the only chart with a time axis was the bonds projection, in the
 * bonds' own currency, about days that have not happened.
 *
 * **A line, and only where there is a line to draw.** Two points make a course; one makes a dot, and an
 * axis drawn around a dot says "flat" about a holding nobody has valued twice.
 *
 * The axis is not pinned to nought. This chart is about movement, and a scale that starts at zero
 * flattens a year of it into a straight line near the top — the opposite of what it exists to show.
 */
export const GrowthChart = () => {
  const { growth, currency } = useNetWorth();

  const config = {
    value: { label: i18n.t('holdings.growth.series'), color: 'var(--chart-1)' },
  } satisfies ChartConfig;

  const rows = growth.map((point) => ({
    day: formatDate(point.on),
    value: point.value,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('holdings.growth.title')}</CardTitle>
        <CardDescription>{i18n.t('holdings.growth.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        {rows.length ? (
          <>
            {/* The figure the line is about, said in words as well as drawn: what it has done since
                the first day there is a reading for. */}
            <p className="mb-3 text-sm" data-slot="growth-since">
              {i18n.t('holdings.growth.since', {
                date: rows[0].day,
                amount: formatMoney(
                  rows[rows.length - 1].value - rows[0].value,
                  currency,
                  'pl'
                ),
              })}
            </p>

            <ChartContainer config={config} className="h-[220px] w-full">
              <LineChart accessibilityLayer data={rows} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  domain={['auto', 'auto']}
                  tickFormatter={(value: number) => formatMoney(value, currency, 'pl')}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="value"
                  type="monotone"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{i18n.t('holdings.growth.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
};
