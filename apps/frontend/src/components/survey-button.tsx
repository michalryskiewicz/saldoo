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
      {/*
        Both `asChild`s matter: TooltipTrigger and Button each render a <button> of
        their own otherwise, and with the link between them that nests a <button>
        inside a <button> — invalid HTML that React reports as a hydration error.
        Forwarding both leaves exactly one element: an anchor styled as a button.
      */}
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="outline"
          size="icon"
          className={cn('cursor-pointer  text-white px-4 py-2 rounded-4xl bg-blue-200 ')}
        >
          <a
            href={SURVEY_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={i18n.t('metrics.fill-survey')}
          >
            <BadgeQuestionMark />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{i18n.t('metrics.fill-survey')}</p>
      </TooltipContent>
    </Tooltip>
  );
};
