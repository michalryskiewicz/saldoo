import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { PageLoader } from '@/components/loaders/page-loader.tsx';
import { VaultShellView } from '@/features/vault/views/vault-shell-view.tsx';
import { vaultDriveSync } from '@/database/sync/sync.container.ts';
import i18n from '@/i18n.ts';

/**
 * Brings this device level with the encrypted backup on Drive before the app is
 * shown. Requires an unlocked vault, so it must sit inside `VaultGate`.
 */
export const DataSyncWrapper = ({ children }: PropsWithChildren) => {
  const [isSyncing, setIsSyncing] = useState(true);
  const [failed, setFailed] = useState(false);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Guarded so a re-render (or StrictMode's double invoke) cannot create the
    // Drive folder/file twice.
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    let cancelled = false;
    vaultDriveSync
      .syncNewestDB()
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isSyncing) {
    return <PageLoader title="metrics.syncing_with_drive" />;
  }

  // Refusing to continue is deliberate: carrying on would let a later export
  // overwrite a backup whose key the user may still be able to recover.
  if (failed) {
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
