import { useCallback, useEffect, useState } from 'react';
import { vaultManager } from '@/database/sync/sync.container.ts';
import type { UnlockSecret } from '@/crypto/vault.service.ts';

export type VaultGateStatus =
  | 'checking'
  | 'needs-setup'
  | 'showing-recovery-code'
  | 'locked'
  | 'unlocked'
  | 'unavailable'
  | 'failed';

export function useVaultGate() {
  const [status, setStatus] = useState<VaultGateStatus>('checking');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    vaultManager
      .bootstrap()
      .then((resolved) => {
        if (!cancelled) setStatus(resolved);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setUp = useCallback(async (passphrase: string) => {
    setIsBusy(true);
    setError(null);
    try {
      setRecoveryCode(await vaultManager.setUp(passphrase));
      setStatus('showing-recovery-code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsBusy(false);
    }
  }, []);

  const unlock = useCallback(async (secret: UnlockSecret) => {
    setIsBusy(true);
    setError(null);
    try {
      await vaultManager.unlock(secret);
      setStatus('unlocked');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsBusy(false);
    }
  }, []);

  const confirmRecoveryCodeSaved = useCallback(() => {
    setRecoveryCode(null);
    setStatus('unlocked');
  }, []);

  return { status, recoveryCode, isBusy, error, setUp, unlock, confirmRecoveryCodeSaved };
}
