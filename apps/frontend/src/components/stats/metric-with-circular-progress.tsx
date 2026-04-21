import { Card, CardContent } from '@/components/ui/card';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';

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
}

export const MetricWithCircularProgress = ({
  title,
  progress,
  budget,
  current,
  fill,
  totalLeft,
}: MetricItem) => {
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
                    progress,
                    budget,
                    current,
                    fill,
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
                  fill={fill}
                  angleAxisId={0}
                />
              </RadialBarChart>
            </ChartContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-medium text-foreground">{progress}%</span>
            </div>
          </div>
          <div>
            <dd className="text-base font-medium text-foreground">
              {current} / {budget}
            </dd>
            <dt className="text-sm text-muted-foreground">
              {title} {totalLeft}
            </dt>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
