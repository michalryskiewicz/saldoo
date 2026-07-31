import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import i18n from '@/i18n.ts';
import { deleteDBProfit } from '@/database/profits.ts';
import { useDispatch } from 'react-redux';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';

export type ProfitsTableActionsProps = {
  profitId: string;
};

export default function ProfitsTableActions({ profitId }: ProfitsTableActionsProps) {
  const dispatch = useDispatch();

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={i18n.t('edit')}
            onClick={() => dispatch(serProfitsDrawerId(profitId))}
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
            className="text-muted-foreground hover:text-destructive"
            aria-label={i18n.t('remove')}
            onClick={() => deleteDBProfit(profitId)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{i18n.t('remove')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
