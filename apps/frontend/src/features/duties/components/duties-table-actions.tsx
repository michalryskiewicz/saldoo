import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EllipsisVertical } from 'lucide-react';
import i18n from '@/i18n.ts';

import type { Row } from '@tanstack/react-table';
import { type DBDuty, deleteDBDuty } from '@/database/duty.ts';

export type DutiesTableActionsProps = {
  row: Row<DBDuty>;
};

export default function DutiesTableActions({ row }: DutiesTableActionsProps) {
  const dutyId = row.original.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
          size="icon"
        >
          <EllipsisVertical />
          <span className="sr-only">{i18n.t('open_menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem variant="destructive" onClick={async () => await deleteDBDuty(dutyId)}>
          {i18n.t('remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
