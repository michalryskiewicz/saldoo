import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { TOTAL } from '@/constant.ts';

type TextCellProps = React.ComponentProps<'p'> & { name: string | undefined };

export default function TextCell({ id, name, className }: TextCellProps) {
  // Blank on the summary row, the way the severity and frequency cells already are. Left to
  // render, the recurrence column asked `formatRecurrence` about a row with neither a date nor a
  // frequency and printed its fallback dash — a stray "-" sitting under the total.
  if (id === TOTAL || !name) {
    return null;
  }

  return <p className={cn(className)}>{name}</p>;
}
