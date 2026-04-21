import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { CircleQuestionMark } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

type InfoTooltipProps = {
  text?: string;
  className?: string;
};

export const InfoTooltip = ({ text, className }: InfoTooltipProps) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <CircleQuestionMark size={14} strokeWidth={1.5} className={cn('ml-2', className)} />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};
