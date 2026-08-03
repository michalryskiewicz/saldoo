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

  // Filled with the same colour the chart uses for this severity, so the table and the graph
  // read as one fact rather than two. A dot in the mark tier could not do that: the value that
  // makes an 8px dot visible on white is not the value a 300px bar can wear.
  return (
    <Badge
      className={cn('text-severity-fill-foreground border-transparent px-2 font-medium', {
        'bg-severity-high-fill': severity === SEVERITY.HIGH,
        'bg-severity-medium-fill': severity === SEVERITY.MEDIUM,
        'bg-severity-low-fill': severity === SEVERITY.LOW,
      })}
    >
      {i18n.t(severity)}
    </Badge>
  );
}
