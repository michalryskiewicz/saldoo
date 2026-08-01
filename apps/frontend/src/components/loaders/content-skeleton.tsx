import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useRevealAfterDelay } from '@/components/loaders/use-reveal-after-delay.ts';
import i18n from '@/i18n.ts';

/**
 * The wait inside the app shell.
 *
 * Once the sidebar and header are on screen, a spinner in the middle of the page
 * throws away the one thing already known — where the content will land. This
 * stands in its place instead: a heading, then the blocks a page is made of.
 *
 * Stacked rather than columned on purpose. Some pages here are a table and some are a
 * grid of cards, so a two-column skeleton promises a layout half of them do not have —
 * a full-width block is the most any page can be assumed to bring.
 */
export function ContentSkeleton() {
  const revealed = useRevealAfterDelay();

  if (!revealed) return null;

  return (
    <div className="flex flex-col gap-4 p-4" role="status" aria-label={i18n.t('metrics.loading')}>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-72" />
      <Skeleton className="h-40" />
    </div>
  );
}
