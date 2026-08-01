import { useSyncExternalStore } from 'react';
import { syncStatusStore } from '@/database/sync/sync-status.store.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { reconnectDrive } from '@/auth/context/google';
import { GoogleDriveGlyph } from '@/components/google-drive/google-drive-glyph.tsx';
import { resolveSyncPresentation } from '@/components/sync-status-presentation.service.ts';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';

/**
 * The Drive mark, carrying the sync state.
 *
 * One control rather than the two that used to sit side by side saying overlapping things — a text
 * status that knew about the outbox and the last sync, beside a Drive icon that knew only whether
 * a token was held, so a green icon could sit next to "changes waiting to be sent".
 *
 * No text. The Drive mark already says *what* the data is synced with, which a generic cloud does
 * not, and the rest is carried by colour, spin and the tooltip: spinning while anything is in
 * flight, `positive` when Drive holds everything, `destructive` when something needs attention.
 *
 * Reconnecting is the only thing a person can act on, so it is the only state that is a button.
 * The rest is a `status` — dressing information as a button invites clicks that do nothing.
 */

const TONE_CLASS = {
  positive: 'text-positive',
  info: 'text-info',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
} as const;

type GoogleDriveButtonProps = {
  /** Resolved by the layout: two components needed this, and each was asking Google itself. */
  isDriveConnected: boolean;
};

export function GoogleDriveButton({ isDriveConnected }: GoogleDriveButtonProps) {
  const status = useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.get()
  );
  const queued = useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.state()
  );

  const { label, tone, isBusy } = resolveSyncPresentation({
    status,
    isPending: queued.pending,
    hasFailedPermanently: queued.failure === 'permanent',
    isDriveConnected,
  });

  const text = i18n.t(label);
  const glyph = <GoogleDriveGlyph className={cn('size-4', isBusy && 'animate-spin')} />;

  if (!isDriveConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={text}
            className="text-destructive hover:text-destructive size-8"
            onClick={() => void reconnectDrive()}
          >
            {glyph}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* `aria-label` rather than visible text: with the label gone, this is the only thing a
            screen reader has, and `aria-live` means the state change is announced. */}
        <span
          role="status"
          aria-live="polite"
          aria-label={text}
          className={cn('flex size-8 items-center justify-center', TONE_CLASS[tone])}
        >
          {glyph}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
