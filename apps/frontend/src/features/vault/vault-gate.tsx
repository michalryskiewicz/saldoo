import type { PropsWithChildren } from 'react';
import { PageLoader } from '@/components/loaders/page-loader.tsx';
import { useVaultGate } from '@/features/vault/use-vault-gate.ts';
import { RecoveryCodeView } from '@/features/vault/views/recovery-code-view.tsx';
import { VaultSetupView } from '@/features/vault/views/vault-setup-view.tsx';
import { VaultShellView } from '@/features/vault/views/vault-shell-view.tsx';
import { VaultUnlockView } from '@/features/vault/views/vault-unlock-view.tsx';
import i18n from '@/i18n.ts';

/**
 * Stands between the user and their data until a data key is available.
 *
 * Nothing downstream can read or write the encrypted backup without an unlocked
 * vault, so this gate — not the router — is what guarantees the key exists.
 */
export function VaultGate({ children }: PropsWithChildren) {
  const { status, recoveryCode, isBusy, error, setUp, unlock, confirmRecoveryCodeSaved } =
    useVaultGate();

  if (status === 'checking') {
    return <PageLoader title="vault.checking" />;
  }

  if (status === 'needs-setup') {
    return (
      <VaultShellView title="vault.setup_title" description="vault.setup_description">
        <VaultSetupView onSubmit={setUp} isSubmitting={isBusy} submitError={error} />
      </VaultShellView>
    );
  }

  if (status === 'showing-recovery-code' && recoveryCode) {
    return (
      <VaultShellView title="vault.recovery_title" description="vault.recovery_subtitle">
        <RecoveryCodeView recoveryCode={recoveryCode} onConfirmed={confirmRecoveryCodeSaved} />
      </VaultShellView>
    );
  }

  if (status === 'locked') {
    return (
      <VaultShellView title="vault.unlock_title" description="vault.unlock_description">
        <VaultUnlockView onUnlock={unlock} isUnlocking={isBusy} unlockError={error} />
      </VaultShellView>
    );
  }

  // Not an error: this device has simply never seen the keyfile, and there is no
  // safe verdict to reach without Drive. Reconnecting resolves it.
  if (status === 'unavailable') {
    return (
      <VaultShellView
        title="vault.unavailable_title"
        description="vault.unavailable_description"
      />
    );
  }

  if (status === 'failed') {
    return (
      <VaultShellView title="vault.failed_title" description="vault.failed_description">
        <p role="alert" className="text-destructive text-sm font-medium">
          {error ?? i18n.t('vault.failed_description')}
        </p>
      </VaultShellView>
    );
  }

  return children;
}
