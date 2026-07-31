import { SEVERITY, TOTAL } from '@/constant.ts';
import { cn } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge.tsx';
import i18n from '@/i18n.ts';

type SeverityCellProps = {
  id: string;
  severity: SEVERITY | null;
};

export default function SeverityCell({ id, severity }: SeverityCellProps) {
  if (id === TOTAL || !severity) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-muted-foreground px-1.5">
      <span
        className={cn('inline-block w-2 h-2 rounded-full mr-1', {
          'bg-severity-high': severity === SEVERITY.HIGH,
          'bg-severity-medium': severity === SEVERITY.MEDIUM,
          'bg-severity-low': severity === SEVERITY.LOW,
        })}
      />

      {i18n.t(severity)}
    </Badge>
  );
}
