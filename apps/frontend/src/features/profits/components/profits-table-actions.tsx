import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EllipsisVertical } from 'lucide-react';
import i18n from '@/i18n.ts';
import type { Row } from '@tanstack/react-table';
import { type DBProfit, deleteDBProfit } from '@/database/profits.ts';
import { useDispatch } from 'react-redux';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';

export type ProfitsTableActionsProps = {
  row: Row<DBProfit>;
};

export default function ProfitsTableActions({ row }: ProfitsTableActionsProps) {
  const profitId = row.original.id;
  const dispatch = useDispatch();

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
        <DropdownMenuItem onClick={() => dispatch(serProfitsDrawerId(profitId))}>
          {i18n.t('edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => deleteDBProfit(profitId)}>
          {i18n.t('remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
