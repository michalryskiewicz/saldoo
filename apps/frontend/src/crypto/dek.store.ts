import Dexie, { type Table } from 'dexie';

/** Per-device cache of the unlocked data key, so unlocking is once per device. */
export interface DekStore {
  read(): Promise<CryptoKey | null>;
  write(dek: CryptoKey): Promise<void>;
  clear(): Promise<void>;
}

const SINGLETON_ID = 'dek';

type StoredKey = { id: string; key: CryptoKey };

/**
 * Deliberately its own Dexie database rather than a table on the app database:
 * `exportDB` serialises every table it is given, so a data key living next to the
 * app's tables would be written straight into the backup on Drive.
 */
class VaultKeyDB extends Dexie {
  keys!: Table<StoredKey, string>;

  constructor() {
    super('saldoo-vault');
    this.version(1).stores({ keys: '&id' });
  }
}

export function createIndexedDbDekStore(): DekStore {
  const database = new VaultKeyDB();

  return {
    async read() {
      const stored = await database.keys.get(SINGLETON_ID);
      return stored?.key ?? null;
    },

    async write(dek) {
      // The CryptoKey is structured-cloned as-is, so the raw key bytes are never
      // materialised as a JS value we would then have to scrub.
      await database.keys.put({ id: SINGLETON_ID, key: dek });
    },

    async clear() {
      await database.keys.delete(SINGLETON_ID);
    },
  };
}
