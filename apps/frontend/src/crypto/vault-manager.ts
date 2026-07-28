import type { DekStore } from '@/crypto/dek.store.ts';
import type { VaultSession } from '@/crypto/vault-session.ts';
import { createVault, unlockVault, type Keyfile, type UnlockSecret } from '@/crypto/vault.service.ts';

export type VaultStatus = 'needs-setup' | 'locked' | 'unlocked';

export interface KeyfileRepository {
  load(): Promise<Keyfile | null>;
  save(keyfile: Keyfile): Promise<void>;
}

/**
 * Drives the vault's lifecycle across app start, setup and unlock.
 *
 * The keyfile on Drive is the single source of truth for whether a vault exists —
 * a cached data key alone is never enough, because the user may have created a new
 * vault elsewhere or removed the file.
 */
export type VaultFactory = typeof createVault;

export class VaultManager {
  constructor(
    private readonly keyfiles: KeyfileRepository,
    private readonly dekStore: DekStore,
    private readonly session: VaultSession,
    private readonly vaultFactory: VaultFactory = createVault
  ) {}

  /**
   * @throws {CorruptKeyfileError} which must reach the user rather than being
   * mistaken for "no vault yet" — see the repository for why.
   */
  async bootstrap(): Promise<VaultStatus> {
    const keyfile = await this.keyfiles.load();

    if (!keyfile) {
      // A key cached against a vault that no longer exists would silently unlock
      // nothing, so it is dropped before setup starts.
      await this.dekStore.clear();
      this.session.lock();
      return 'needs-setup';
    }

    const cached = await this.dekStore.read();
    if (!cached) return 'locked';

    this.session.unlock(cached);
    return 'unlocked';
  }

  /**
   * Creates the vault and publishes its keyfile.
   *
   * @returns the recovery code — the only copy that will ever exist.
   */
  async setUp(passphrase: string): Promise<string> {
    const { dek, recoveryCode, keyfile } = await this.vaultFactory({ passphrase });

    // Published before the key is cached: a device holding a key whose keyfile
    // never reached Drive could write a backup no other device could open.
    await this.keyfiles.save(keyfile);
    await this.dekStore.write(dek);
    this.session.unlock(dek);

    return recoveryCode;
  }

  /** @throws {VaultUnlockError} when the secret opens no keyslot. */
  async unlock(secret: UnlockSecret): Promise<void> {
    const keyfile = await this.keyfiles.load();
    if (!keyfile) throw new Error('Cannot unlock: no keyfile on Drive');

    const dek = await unlockVault(keyfile, secret);

    await this.dekStore.write(dek);
    this.session.unlock(dek);
  }

  async lock(): Promise<void> {
    this.session.lock();
    await this.dekStore.clear();
  }
}
