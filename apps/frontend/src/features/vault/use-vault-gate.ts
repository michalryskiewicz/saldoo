import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { vaultManager } from '@/database/sync/sync.container.ts';
import { vaultSession } from '@/crypto/vault-session.ts';
import type { UnlockSecret } from '@/crypto/vault.service.ts';
import { resolveVaultGateStatus } from '@/features/vault/vault-gate-status.service.ts';
import { useIdleLock } from '@/features/vault/use-idle-lock.ts';

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

  const isSessionUnlocked = useSyncExternalStore(
    (listener) => vaultSession.subscribe(listener),
    () => vaultSession.isUnlocked()
  );

  useIdleLock(isSessionUnlocked);

  return {
    status: resolveVaultGateStatus(status, isSessionUnlocked),
    recoveryCode,
    isBusy,
    error,
    setUp,
    unlock,
    confirmRecoveryCodeSaved,
  };
}
