import type { DekStore } from '@/crypto/dek.store.ts';
import type { KeyfileCache } from '@/crypto/keyfile-cache.store.ts';
import type { VaultSession } from '@/crypto/vault-session.ts';
import { createVault, unlockVault, type Keyfile, type UnlockSecret } from '@/crypto/vault.service.ts';

/**
 * `unavailable` is the one honest dead end: Drive could not be reached and this
 * device has never seen a keyfile, so there is no safe verdict to act on. It is
 * not a failure — reconnecting resolves it.
 */
export type VaultStatus = 'needs-setup' | 'locked' | 'unlocked' | 'unavailable';

/**
 * What the keyfile store was able to say about the vault.
 *
 * `absent` is an authoritative "no vault has ever been created" and is acted on
 * destructively — it clears this device's cached data key. `unreachable` is the
 * honest "we could not find out", and must never be collapsed into it.
 */
export type KeyfileLookup =
  | { status: 'present'; keyfile: Keyfile }
  | { status: 'absent' }
  | { status: 'unreachable' };

export interface KeyfileRepository {
  load(): Promise<KeyfileLookup>;
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
    private readonly keyfileCache: KeyfileCache,
    private readonly vaultFactory: VaultFactory = createVault
  ) {}

  /**
   * @throws {CorruptKeyfileError} which must reach the user rather than being
   * mistaken for "no vault yet" — see the repository for why.
   */
  async bootstrap(): Promise<VaultStatus> {
    const lookup = await this.keyfiles.load();

    if (lookup.status === 'absent') {
      // A key cached against a vault that no longer exists would silently unlock
      // nothing, so both remembered artefacts are dropped before setup starts.
      await this.dekStore.clear();
      await this.keyfileCache.clear();
      this.session.lock();
      return 'needs-setup';
    }

    if (lookup.status === 'present') {
      await this.keyfileCache.write(lookup.keyfile);
    } else if (!(await this.keyfileCache.read())) {
      // Unreachable and never seen here, so there is no verdict to reach. Nothing
      // is cleared: "we could not look" is not evidence that the vault is gone.
      return 'unavailable';
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
    await this.keyfileCache.write(keyfile);
    await this.dekStore.write(dek);
    this.session.unlock(dek);

    return recoveryCode;
  }

  /** @throws {VaultUnlockError} when the secret opens no keyslot. */
  async unlock(secret: UnlockSecret): Promise<void> {
    const keyfile = await this.readableKeyfile();
    if (!keyfile) throw new Error('Cannot unlock: no keyfile available');

    const dek = await unlockVault(keyfile, secret);

    await this.dekStore.write(dek);
    this.session.unlock(dek);
  }

  async lock(): Promise<void> {
    this.session.lock();
    await this.dekStore.clear();
  }

  /** Drive's answer when it has one, otherwise the last keyfile this device saw. */
  private async readableKeyfile(): Promise<Keyfile | null> {
    const lookup = await this.keyfiles.load();
    if (lookup.status === 'present') return lookup.keyfile;
    if (lookup.status === 'absent') return null;

    return this.keyfileCache.read();
  }
}
