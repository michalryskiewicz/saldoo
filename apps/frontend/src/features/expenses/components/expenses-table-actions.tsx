import { Pencil, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import i18n from '@/i18n.ts';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { paths } from '@/routes/paths.ts';
import {
  setConvertingExpenseId,
  setExpensesDrawerId,
  setGoalsDrawerId,
} from '@/store/preferences.slice.ts';
import { deleteDBExpense } from '@/database/expenses';

export type ExpensesTableActionsProps = {
  expenseId: string;
};

export default function ExpensesTableActions({ expenseId }: ExpensesTableActionsProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Opens the goal form on this cost rather than converting behind the person's back: whether the
  // money stays theirs is the one thing the app cannot work out, and it decides what the lifetime
  // figure means. Ending the expense happens when they save, not when they click.
  const convert = () => {
    dispatch(setConvertingExpenseId(expenseId));
    dispatch(setGoalsDrawerId(NEW_ENTITY_ID));
    navigate(paths.dashboard.goals);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={i18n.t('edit')}
            onClick={() => dispatch(setExpensesDrawerId(expenseId))}
          >
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('edit')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={i18n.t('goal.convert')}
            onClick={convert}
          >
            <Target className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('goal.convert')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={i18n.t('remove')}
            onClick={() => deleteDBExpense(expenseId)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('remove')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
