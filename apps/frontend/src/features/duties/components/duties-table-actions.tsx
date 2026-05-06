import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import i18n from '@/i18n.ts';

import type { Row } from '@tanstack/react-table';
import { type DBDuty, deleteDBDuty } from '@/database/duty.ts';

export type DutiesTableActionsProps = {
  row: Row<DBDuty>;
};

export default function DutiesTableActions({ row }: DutiesTableActionsProps) {
  const dutyId = row.original.id;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={i18n.t('remove')}
          onClick={() => deleteDBDuty(dutyId)}
        >
          <Trash2 className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{i18n.t('remove')}</TooltipContent>
    </Tooltip>
  );
}
