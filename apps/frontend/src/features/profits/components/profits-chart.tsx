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
import { formatMonth, formatMoneyValue } from '@/lib/formats.ts';
import { useSettings } from '@/features/settings/use-settings.ts';
import { useSidebar } from '@/components/ui/sidebar.tsx';
import { paths } from '@/routes/paths';
import i18n from '@/i18n.ts';
import { Link } from 'react-router';
import { useListProfits } from '@/features/profits/hooks/use-list-profits.tsx';
import { groupProfitsByMonth } from '@/lib/profits.ts';

/**
 * One series and one colour.
 *
 * The expenses chart offers a second reading — the same bars split by priority — because an
 * expense carries one. A profit does not: there is nothing to split it by, and a tab strip
 * offering one choice is a control that has to be read and then ignored.
 */
const chartConfig = {
  total: {
    label: i18n.t('profits'),
    color: 'var(--series-profit)',
  },
} satisfies ChartConfig;

export const ProfitsChart = () => {
  const { allProfits } = useListProfits();
  const { settings } = useSettings();
  const { isMobile } = useSidebar();

  const chartData = groupProfitsByMonth(allProfits ?? []);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>{i18n.t('profits_chart_title')}</CardTitle>
          <CardDescription>
            {i18n.t('profits_chart_description')}{' '}
            <Link to={paths.account.root} className="underline">
              {i18n.t('here_to_link')}
            </Link>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart accessibilityLayer data={chartData} margin={{ top: 30 }}>
            <CartesianGrid vertical={false} />
            <YAxis tickLine={true} axisLine={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                formatMonth(value, { type: isMobile ? 'short' : 'long', locale: 'pl' })
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  className="w-[180px]"
                  formatter={(value, name) => (
                    <>
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
                        style={
                          { '--color-bg': `var(--color-${name})` } as React.CSSProperties
                        }
                      />
                      {chartConfig[name as keyof typeof chartConfig]?.label || name}
                      <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                        {formatMoneyValue(value, settings?.currency)}
                      </div>
                    </>
                  )}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
