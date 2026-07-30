import Dexie, { type Table } from 'dexie';
import type { Keyfile } from '@/crypto/vault.service.ts';

export type StoredKeyfile = { id: string; keyfile: Keyfile };

/**
 * The unlocked data key, usable only by the browser session that put it here.
 *
 * `dek` is the `CryptoKey` object itself, kept non-extractable by structured clone —
 * not its bytes. `witness` must match the one in `sessionStorage`; see
 * `session-key-cache.ts` for why that is what makes closing the browser lock the vault.
 */
export type StoredSessionKey = {
  id: string;
  dek: CryptoKey;
  witness: string;
  createdAt: number;
};

/**
 * Everything this device remembers about the vault itself — which is now only the
 * keyfile, and a keyfile holds the data key *wrapped*.
 *
 * Deliberately its own Dexie database rather than tables on the app database:
 * `exportDB` serialises every table it is given, so anything living next to the
 * app's tables would be written straight into the backup on Drive.
 */
export class VaultKeyDB extends Dexie {
  keyfiles!: Table<StoredKeyfile, string>;
  sessionKeys!: Table<StoredSessionKey, string>;

  constructor(name = 'saldoo-vault') {
    super(name);
    this.version(1).stores({ keys: '&id' });
    this.version(2).stores({ keys: '&id', keyfiles: '&id' });
    // v3 drops `keys` outright. The unwrapped data key used to live there so that
    // unlocking was once per device; it now never leaves memory. This upgrade is
    // what deletes the copy already sitting on existing users' disks — without it,
    // the release that stops persisting the key still leaves every old one behind.
    this.version(3).stores({ keys: null, keyfiles: '&id' });
    // v4 reintroduces a stored key — but session-scoped, age-limited and still
    // non-extractable, which the `keys` table v3 deleted was none of.
    this.version(4).stores({ keys: null, keyfiles: '&id', sessionKeys: '&id' });
  }
}

export const createVaultKeyDb = (name?: string) => new VaultKeyDB(name);
