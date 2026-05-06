import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { Link } from 'react-router';

import { Card, CardContent } from '@/components/ui/card';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import { Button } from '@/components/ui/button';

const chartConfig = {
  progress: {
    label: 'Progress',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

interface MetricItem {
  title: string;
  progress: number; // 0-100 percentage
  budget: string; // formatted currency string
  current: string; // formatted currency string
  fill: string; // CSS color (e.g. "var(--chart-4)")
  totalLeft: string;
  isEmpty?: boolean;
  emptyDescription?: string;
  emptyIcon?: ComponentType<LucideProps>;
  emptyCtaLabel?: string;
  emptyCtaTo?: string;
}

export const MetricWithCircularProgress = ({
  title,
  progress,
  budget,
  current,
  fill,
  totalLeft,
  isEmpty = false,
  emptyDescription,
  emptyIcon: EmptyIcon,
  emptyCtaLabel,
  emptyCtaTo,
}: MetricItem) => {
  const ringFill = isEmpty ? 'var(--muted)' : fill;
  const ringProgress = isEmpty ? 0 : progress;

  return (
    <Card className="relative overflow-hidden w-full">
      <CardContent className="p-4 py-0">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <ChartContainer config={chartConfig} className="h-[100px] w-[100px]">
              <RadialBarChart
                data={[
                  {
                    title,
                    progress: ringProgress,
                    budget,
                    current,
                    fill: ringFill,
                    totalLeft,
                  },
                ]}
                innerRadius={30}
                outerRadius={60}
                barSize={6}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                  axisLine={false}
                />
                <RadialBar
                  dataKey="progress"
                  background
                  cornerRadius={10}
                  fill={ringFill}
                  angleAxisId={0}
                />
              </RadialBarChart>
            </ChartContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              {isEmpty ? (
                EmptyIcon ? (
                  <EmptyIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <span className="text-base font-medium text-muted-foreground">—</span>
                )
              ) : (
                <span className="text-base font-medium text-foreground">{progress}%</span>
              )}
            </div>
          </div>
          {isEmpty ? (
            <div className="flex flex-col gap-2">
              <dt className="text-sm font-medium text-foreground">{title}</dt>
              {emptyDescription && (
                <dd className="text-xs text-muted-foreground max-w-[24ch]">{emptyDescription}</dd>
              )}
              {emptyCtaLabel && emptyCtaTo && (
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link to={emptyCtaTo}>{emptyCtaLabel}</Link>
                </Button>
              )}
            </div>
          ) : (
            <div>
              <dd className="text-base font-medium text-foreground">
                {current} / {budget}
              </dd>
              <dt className="text-sm text-muted-foreground">
                {title} {totalLeft}
              </dt>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
