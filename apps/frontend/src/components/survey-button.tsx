import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';
import { BadgeQuestionMark } from 'lucide-react';

const SURVEY_URL = 'https://forms.gle/3iXbrFWzpC9i529E8';

export const SurveysButton = () => {
  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <Tooltip>
      <TooltipTrigger>
        <a href={SURVEY_URL} target="_blank" rel="noreferrer">
          <Button
            variant="outline"
            size="icon"
            aria-label="Submit"
            className={cn('cursor-pointer  text-white px-4 py-2 rounded-4xl bg-blue-200 ')}
          >
            <BadgeQuestionMark />
          </Button>
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <p>{i18n.t('metrics.fill-survey')}</p>
      </TooltipContent>
    </Tooltip>
  );
};
