import { useSyncExternalStore } from 'react';
import { TriangleAlert } from 'lucide-react';
import { outbox } from '@/database/document/outbox.container.ts';
import { reconnectDrive } from '@/auth/context/google';
import { resolveSyncAlert } from '@/components/sync-alert.service.ts';
import { useIsOnline } from '@/hooks/use-is-online.ts';
import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';

type SyncAlertBannerProps = {
  /** Resolved by the layout, so the whole app polls Google for this once rather than twice. */
  isDriveConnected: boolean;
};

/**
 * The sentence the app owes the user when changes have stopped reaching Drive.
 *
 * The Drive mark in the header carries every ordinary state and is enough while things
 * work. It was not enough for the state that looks like working: changes piling up on this
 * device with nothing able to send them, announced by a small red glyph it takes an hour
 * to notice.
 *
 * Never a dismissal and never a sign-out — one sentence and the single action that fixes
 * it. What counts as worth saying is decided in `sync-alert.service.ts`.
 */
export function SyncAlertBanner({ isDriveConnected }: SyncAlertBannerProps) {
  const queued = useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.state()
  );
  const isOnline = useIsOnline();

  const alert = resolveSyncAlert({
    isOnline,
    isDriveConnected,
    hasFailedPermanently: queued.failure === 'permanent',
  });

  if (!alert) return null;

  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="grow">{i18n.t(alert.message)}</span>
      <Button size="sm" variant="outline" onClick={() => void reconnectDrive()}>
        {i18n.t('sync.alert_reconnect')}
      </Button>
    </div>
  );
}
