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
 * destructively — it clears what this device remembers of the vault. `unreachable`
 * is the honest "we could not find out", and must never be collapsed into it.
 */
export type KeyfileLookup =
  | { status: 'present'; keyfile: Keyfile }
  | { status: 'absent' }
  | { status: 'unreachable' };

export interface KeyfileRepository {
  load(): Promise<KeyfileLookup>;
  save(keyfile: Keyfile): Promise<void>;
}

export type VaultFactory = typeof createVault;

/**
 * Drives the vault's lifecycle across app start, setup and unlock.
 *
 * The keyfile on Drive is the single source of truth for whether a vault exists.
 * The data key itself is never written anywhere — it lives in {@link VaultSession}
 * and dies with the tab, so every start of the app begins locked. That is the
 * deliberate cost of a device that is worth nothing to whoever picks it up.
 */
export class VaultManager {
  constructor(
    private readonly keyfiles: KeyfileRepository,
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
      // A keyfile cached against a vault that no longer exists would offer to
      // unlock something that is not there, so it is dropped before setup starts.
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

    return 'locked';
  }

  /**
   * Creates the vault and publishes its keyfile.
   *
   * @returns the recovery code — the only copy that will ever exist.
   */
  async setUp(passphrase: string): Promise<string> {
    const { dek, recoveryCode, keyfile } = await this.vaultFactory({ passphrase });

    // Published before the session unlocks: a device holding a key whose keyfile
    // never reached Drive could write a backup no other device could open.
    await this.keyfiles.save(keyfile);
    await this.keyfileCache.write(keyfile);
    this.session.unlock(dek);

    return recoveryCode;
  }

  /** @throws {VaultUnlockError} when the secret opens no keyslot. */
  async unlock(secret: UnlockSecret): Promise<void> {
    const keyfile = await this.readableKeyfile();
    if (!keyfile) throw new Error('Cannot unlock: no keyfile available');

    this.session.unlock(await unlockVault(keyfile, secret));
  }

  /**
   * Drops the data key. The cached keyfile stays: it holds nothing but the *wrapped*
   * key, and throwing it away would cost the user their next offline start for no
   * security gained.
   */
  async lock(): Promise<void> {
    this.session.lock();
  }

  /** Drive's answer when it has one, otherwise the last keyfile this device saw. */
  private async readableKeyfile(): Promise<Keyfile | null> {
    const lookup = await this.keyfiles.load();
    if (lookup.status === 'present') return lookup.keyfile;
    if (lookup.status === 'absent') return null;

    return this.keyfileCache.read();
  }
}
