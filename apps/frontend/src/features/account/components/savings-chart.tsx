import { Pie, PieChart } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart.tsx';
import { useWatch } from 'react-hook-form';
import i18n, { type TranslationKey } from '@/i18n';
import { BUDGETING_STRATEGIES, STRATEGY_PART } from '@/constant.ts';
import { STRATEGY_PART_COLOR } from '@/lib/strategy-part-color.ts';

const chartConfig = {
  expanses: {
    label: 'Expanses',
  },
  [STRATEGY_PART.NEEDS]: {
    label: i18n.t(STRATEGY_PART.NEEDS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.NEEDS],
  },
  [STRATEGY_PART.WANTS]: {
    label: i18n.t(STRATEGY_PART.WANTS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.WANTS],
  },
  [STRATEGY_PART.SAVINGS]: {
    label: i18n.t(STRATEGY_PART.SAVINGS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.SAVINGS],
  },
  [STRATEGY_PART.NEEDS_AND_WANTS]: {
    label: i18n.t(STRATEGY_PART.NEEDS_AND_WANTS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.NEEDS_AND_WANTS],
  },
  [STRATEGY_PART.DEBTS]: {
    label: i18n.t(STRATEGY_PART.DEBTS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.DEBTS],
  },
  [STRATEGY_PART.LONG_TERM_SAVINGS]: {
    label: i18n.t(STRATEGY_PART.LONG_TERM_SAVINGS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.LONG_TERM_SAVINGS],
  },
  [STRATEGY_PART.SHORT_TERM_SAVINGS]: {
    label: i18n.t(STRATEGY_PART.SHORT_TERM_SAVINGS),
    color: STRATEGY_PART_COLOR[STRATEGY_PART.SHORT_TERM_SAVINGS],
  },
} satisfies ChartConfig;

export const SavingsChart = () => {
  const strategy = useWatch({ name: 'strategy' }) as keyof typeof BUDGETING_STRATEGIES;

  return (
    <ChartContainer
      config={chartConfig}
      className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[250px] w-full"
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_, __, item) => {
                return (
                  <div className="flex flex-row justify-between items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg) "
                      style={
                        {
                          '--color-bg': `var(--color-${item.payload.type})`,
                        } as React.CSSProperties
                      }
                    />

                    {i18n.t(item.payload.type)}
                    <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
                      {item.value}%
                    </div>
                  </div>
                );
              }}
            />
          }
          cursor={false}
          defaultIndex={1}
        />
        <ChartLegend
          content={
            <ChartLegendContent
              nameKey="expanses"
              getLabel={(item) => {
                const type = (item as { payload?: { type: TranslationKey } })?.payload?.type;
                return type ? i18n.t(type) : '';
              }}
            />
          }
          className="flex flex-wrap lg:flex-nowrap"
        />
        <Pie data={BUDGETING_STRATEGIES[strategy]} dataKey="expanses"></Pie>
      </PieChart>
    </ChartContainer>
  );
};
