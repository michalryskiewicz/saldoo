import { FREQUENCY, TOTAL } from '@/constant.ts';
import { Badge } from '@/components/ui/badge.tsx';
import i18n from '@/i18n.ts';
import { cn } from '@/lib/utils.ts';

type FrequencyCellProps = {
  id: string;
  frequency: FREQUENCY | undefined;
};

export default function FrequencyCell({ id, frequency }: FrequencyCellProps) {
  if (id === TOTAL || !frequency) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-muted-foreground px-1.5">
      <span
        className={cn('inline-block w-2 h-2 rounded-full mr-2', {
          'bg-blue-500': frequency === FREQUENCY.DAILY,
          'bg-green-500': frequency === FREQUENCY.WEEKLY,
          'bg-amber-500': frequency === FREQUENCY.MONTHLY,
          'bg-purple-500': frequency === FREQUENCY.YEARLY,
        })}
      />
      {i18n.t(frequency)}
    </Badge>
  );
}
