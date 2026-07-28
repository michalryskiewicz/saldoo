import { useSyncExternalStore } from 'react';
import { Cloud, CloudOff, RefreshCw, ShieldAlert } from 'lucide-react';
import { syncStatusStore, type SyncStatus } from '@/database/sync/sync-status.store.ts';
import { cn } from '@/lib/utils.ts';
import type { TranslationKey } from '@/i18n.ts';
import i18n from '@/i18n.ts';

const PRESENTATION: Record<
  SyncStatus,
  { icon: typeof Cloud; label: TranslationKey; className: string }
> = {
  idle: { icon: Cloud, label: 'sync.idle', className: 'text-muted-foreground' },
  syncing: { icon: RefreshCw, label: 'sync.syncing', className: 'text-muted-foreground' },
  synced: { icon: Cloud, label: 'sync.synced', className: 'text-muted-foreground' },
  offline: { icon: CloudOff, label: 'sync.offline', className: 'text-muted-foreground' },
  blocked: { icon: ShieldAlert, label: 'sync.blocked', className: 'text-destructive' },
};

/**
 * Says where this device stands with Drive.
 *
 * Sync stopped being a blocking screen, so this is the only place the user learns
 * that a change has not left the device yet.
 */
export function SyncStatusIndicator() {
  const status = useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.get()
  );
  const { icon: Icon, label, className } = PRESENTATION[status];

  return (
    <span
      className={cn('flex items-center gap-1.5 text-xs', className)}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn('size-3.5', status === 'syncing' && 'animate-spin')} aria-hidden />
      <span className="hidden sm:inline">{i18n.t(label)}</span>
    </span>
  );
}
