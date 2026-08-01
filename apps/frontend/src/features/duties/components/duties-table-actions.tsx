import { Ban, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import i18n from '@/i18n.ts';

import { ignoreDBDuty } from '@/database/duty.ts';

export type DutiesTableActionsProps = {
  dutyId: string;
  ignored: boolean;
};

/**
 * Skipping an occurrence, and taking that back.
 *
 * Where a delete used to be. Deleting a duty reported success and then undid itself: the
 * row's identity is computed from its expense, so the next generation of that range minted
 * it again. A mark on a row that stays is the only thing that survives.
 *
 * Reversible from the row rather than from a toast. A toast is gone in seconds, and a
 * mis-click that could not be taken back afterwards would be worse than the delete this
 * replaces — that one at least undid itself.
 */
export default function DutiesTableActions({ dutyId, ignored }: DutiesTableActionsProps) {
  const action = ignored ? i18n.t('restore') : i18n.t('skip');
  const Icon = ignored ? Undo2 : Ban;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={action}
          onClick={() => ignoreDBDuty(dutyId, !ignored)}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action}</TooltipContent>
    </Tooltip>
  );
}
