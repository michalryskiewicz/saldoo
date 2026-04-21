import * as React from 'react';
import { cn } from '@/lib/utils.ts';

type TextCellProps = React.ComponentProps<'p'> & { name: string | undefined };

export default function TextCell({ name, className }: TextCellProps) {
  if (!name) {
    return null;
  }

  return <p className={cn(className)}>{name}</p>;
}
