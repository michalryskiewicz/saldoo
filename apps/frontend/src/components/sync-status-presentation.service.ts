import { Cloud, CloudOff, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { SyncStatus } from '@/database/sync/sync-status.store.ts';
import type { TranslationKey } from '@/i18n.ts';

/**
 * What the sync control should show, decided in one place.
 *
 * Its own module because it is a decision rather than a rendering: the component asks it what to
 * display, and the urgency order below is the thing worth testing.
 */

export type SyncPresentation = {
  icon: typeof Cloud;
  label: TranslationKey;
  /** Destructive states earn colour; the rest stay quiet so the figures keep the attention. */
  isProblem?: boolean;
  /** Spinning means work is in flight, and nothing else may spin. */
  isBusy?: boolean;
};

const BY_SYNC_STATUS: Record<SyncStatus, SyncPresentation> = {
  idle: { icon: Cloud, label: 'sync.idle' },
  syncing: { icon: RefreshCw, label: 'sync.syncing', isBusy: true },
  synced: { icon: Cloud, label: 'sync.synced' },
  offline: { icon: CloudOff, label: 'sync.offline' },
  blocked: { icon: ShieldAlert, label: 'sync.blocked', isProblem: true },
  'unreadable-backup': { icon: ShieldAlert, label: 'sync.unreadable_backup', isProblem: true },
};

/**
 * Which of the things this device knows deserves the icon.
 *
 * The order is a judgement about urgency, not an implementation detail. A lost Drive connection
 * outranks everything, because nothing else can make progress until it returns. A permanently
 * failed upload outranks a pending one. A change the user just made and that has not left the
 * device outranks how the last sync went — that one is theirs, and it is what they would want
 * to know.
 */
export function resolveSyncPresentation({
  status,
  isPending,
  hasFailedPermanently,
  isDriveConnected,
}: {
  status: SyncStatus;
  isPending: boolean;
  hasFailedPermanently: boolean;
  isDriveConnected: boolean;
}): SyncPresentation {
  if (!isDriveConnected) {
    return {
      icon: TriangleAlert,
      label: 'metrics.need_to_sync_with_google_drive',
      isProblem: true,
    };
  }

  if (hasFailedPermanently) {
    return { icon: TriangleAlert, label: 'sync.upload_failed', isProblem: true };
  }

  if (isPending) return { icon: RefreshCw, label: 'sync.pending', isBusy: true };

  return BY_SYNC_STATUS[status];
}
