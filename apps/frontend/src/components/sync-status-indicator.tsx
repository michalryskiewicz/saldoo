import { useSyncExternalStore } from 'react';
import { syncStatusStore } from '@/database/sync/sync-status.store.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { driveTokenService } from '@/auth/google/drive-token.ts';
import { useGoogleDriveAuthStatus } from '@/components/google-drive/use-google-drive-auth-status.tsx';
import { resolveSyncPresentation } from '@/components/sync-status-presentation.service.ts';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';

/**
 * One control for where this device stands with Drive.
 *
 * It used to be two, side by side, saying overlapping things: a text status that knew about the
 * outbox and the last sync, and a Drive button that knew only whether a token was held. They
 * could disagree — a green Drive icon beside "changes waiting to be sent" — and neither said
 * what the other knew.
 *
 * The icon *is* the status now: it spins while anything is in flight, stays quiet when Drive has
 * everything, and turns destructive when something needs attention. Reconnecting is the one thing
 * a person can actually do about any of it, so it is the only state that becomes a button.
 */
export function SyncStatusIndicator() {
  const status = useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.get()
  );
  const queued = useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.state()
  );
  const isDriveConnected = useGoogleDriveAuthStatus();

  const { icon: Icon, label, isProblem, isBusy } = resolveSyncPresentation({
    status,
    isPending: queued.pending,
    hasFailedPermanently: queued.failure === 'permanent',
    isDriveConnected,
  });

  const text = i18n.t(label);

  const body = (
    <>
      <Icon className={cn('size-3.5 shrink-0', isBusy && 'animate-spin')} aria-hidden />
      <span className="hidden sm:inline">{text}</span>
    </>
  );

  // The one state a person can act on. Dressing the others as buttons would invite clicks
  // that do nothing.
  if (!isDriveConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void driveTokenService.connect().then(() => window.location.reload());
            }}
            className="text-destructive hover:text-destructive h-8 gap-1.5 px-2 text-xs"
          >
            {body}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs',
        isProblem ? 'text-destructive' : 'text-muted-foreground'
      )}
      role="status"
      aria-live="polite"
      title={text}
    >
      {body}
    </span>
  );
}
