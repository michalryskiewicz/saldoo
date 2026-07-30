import { type PropsWithChildren, useEffect, useSyncExternalStore } from 'react';
import { VaultShellView } from '@/features/vault/views/vault-shell-view.tsx';
import { vaultDriveSync } from '@/database/sync/sync.container.ts';
import { openDocument } from '@/database/document/document.container.ts';
import { decideSyncStatus } from '@/database/sync/sync-outcome.service.ts';
import { syncStatusStore } from '@/database/sync/sync-status.store.ts';
import { archivedBackupName } from '@/database/sync/archived-backup-name.service.ts';
import { CONFIG } from '@/global-config.ts';
import i18n from '@/i18n.ts';

/**
 * Brings this device level with the encrypted backup on Drive, in the background.
 *
 * The local database is the source of truth, so the app renders straight away and
 * the sync only reports how far it got. It refuses to continue for exactly one
 * class of failure — see `decideSyncStatus`. Requires an unlocked vault, so it
 * must sit inside `VaultGate`.
 */
export const DataSyncWrapper = ({ children }: PropsWithChildren) => {
  const status = useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.get()
  );
  useEffect(() => {
    const sync = async () => {
      // The status is the record of a sync being in flight, so it is also the
      // guard: a re-render, StrictMode's double invoke, or a burst of `online`
      // events must not create the Drive folder/file twice.
      if (syncStatusStore.get() === 'syncing') return;
      syncStatusStore.set('syncing');

      // Before anything else: the document is the local truth and Dexie is a read
      // model projected from it, so a sync running first would be reading a model
      // that had not been rebuilt yet. Idempotent, so StrictMode's double invoke
      // and the `online` handler both land on the same open.
      await openDocument();

      const attempt = await vaultDriveSync
        .syncNewestDB()
        .then(() => ({ ok: true }) as const)
        .catch((error: unknown) => ({ ok: false, error }) as const);

      syncStatusStore.set(decideSyncStatus(attempt));
    };

    void sync();

    // Without this a device that started offline stays stale until a reload.
    const resync = () => void sync();
    window.addEventListener('online', resync);

    return () => window.removeEventListener('online', resync);
  }, []);

  if (status === 'unreadable-backup') {
    return (
      <VaultShellView
        title="vault.unreadable_backup_title"
        description="vault.unreadable_backup_description"
      >
        <p role="alert" className="text-destructive text-sm font-medium">
          {i18n.t('vault.unreadable_backup_instruction', {
            directory: CONFIG.dataSourceDirectory,
            file: CONFIG.dataSourceFile,
            archived: archivedBackupName(CONFIG.dataSourceFile),
          })}
        </p>
      </VaultShellView>
    );
  }

  if (status === 'blocked') {
    return (
      <VaultShellView title="vault.sync_failed_title" description="vault.sync_failed_description">
        <p role="alert" className="text-destructive text-sm font-medium">
          {i18n.t('vault.sync_failed_description')}
        </p>
      </VaultShellView>
    );
  }

  return children;
};
