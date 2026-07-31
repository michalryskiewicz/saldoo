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
        {/* The same ghost icon button as the rest of the header. It used to be a `blue-200` pill
            with white text — a hardcoded shade answering to no token, and white on that blue is
            nowhere near readable. Standing beside a bordered theme toggle and a bare Drive mark, it
            also made three controls doing comparable jobs look like three unrelated things, which
            is most of why the header read as noise. */}
        <Button asChild variant="ghost" size="icon" className={cn('cursor-pointer')}>
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
