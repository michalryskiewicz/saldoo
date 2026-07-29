import type { VaultGateStatus } from '@/features/vault/use-vault-gate.ts';

/**
 * Reconciles what the gate last decided with whether the session still holds a key.
 *
 * The idle lock does not go through the gate — it drops the key straight from the
 * session — so `unlocked` is the one verdict that has to be re-checked against
 * reality on every render. Every other status describes a device that was never
 * unlocked in the first place, and locking those would only lose the screen the
 * user is on, including the one showing a recovery code that exists nowhere else.
 */
export function resolveVaultGateStatus(
  status: VaultGateStatus,
  isSessionUnlocked: boolean
): VaultGateStatus {
  if (status !== 'unlocked') return status;

  return isSessionUnlocked ? 'unlocked' : 'locked';
}
