import { Spinner } from '@/components/ui/spinner.tsx';
import { useRevealAfterDelay } from '@/components/loaders/use-reveal-after-delay.ts';
import i18n from '@/i18n.ts';

/**
 * The one wait shown before the app shell exists.
 *
 * Every gate on the way in — identity, the vault, onboarding — shows this same
 * screen, with the same words. They used to show three, at three depths of the
 * tree, so entering the app meant watching it change its mind about what waiting
 * looks like. It takes no props on purpose: a caller that could pass a title could
 * bring the relay back.
 */
export function AppLoading() {
  const revealed = useRevealAfterDelay();

  if (!revealed) return null;

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center">
      <div className="text-muted-foreground flex items-center gap-3" role="status">
        {/* The primitive announces itself as a status in English; here the words below do that, in
            the user's language, so the glyph steps out of the accessibility tree entirely. */}
        <Spinner className="size-5" role="presentation" aria-label={undefined} aria-hidden />
        <span className="text-sm">{i18n.t('metrics.loading')}</span>
      </div>
    </div>
  );
}
