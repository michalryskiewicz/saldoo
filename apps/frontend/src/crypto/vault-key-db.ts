import Dexie, { type Table } from 'dexie';
import type { Keyfile } from '@/crypto/vault.service.ts';

export type StoredKey = { id: string; key: CryptoKey };
export type StoredKeyfile = { id: string; keyfile: Keyfile };

/**
 * Everything this device remembers about the vault itself.
 *
 * Deliberately its own Dexie database rather than tables on the app database:
 * `exportDB` serialises every table it is given, so anything living next to the
 * app's tables would be written straight into the backup on Drive.
 */
export class VaultKeyDB extends Dexie {
  keys!: Table<StoredKey, string>;
  keyfiles!: Table<StoredKeyfile, string>;

  constructor() {
    super('saldoo-vault');
    this.version(1).stores({ keys: '&id' });
    // v2 caches the keyfile so a device that already holds one can start offline.
    // The keyfile only ever holds the data key *wrapped*, and this device already
    // stores the unwrapped one in `keys`, so caching it exposes nothing new.
    this.version(2).stores({ keys: '&id', keyfiles: '&id' });
  }
}

export const createVaultKeyDb = () => new VaultKeyDB();
