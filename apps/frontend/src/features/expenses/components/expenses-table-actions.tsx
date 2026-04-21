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
import { useDispatch } from 'react-redux';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import { type DBExpense, deleteDBExpense } from '@/database/expenses';

export type ExpensesTableActionsProps = {
  row: Row<DBExpense>;
};

export default function ExpensesTableActions({ row }: ExpensesTableActionsProps) {
  const expenseId = row.original.id;

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
        <DropdownMenuItem onClick={() => dispatch(setExpensesDrawerId(expenseId))}>
          {i18n.t('edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => deleteDBExpense(expenseId)}>
          {i18n.t('remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
