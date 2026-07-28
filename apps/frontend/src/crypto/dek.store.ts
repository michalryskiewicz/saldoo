import { createVaultKeyDb, type VaultKeyDB } from '@/crypto/vault-key-db.ts';

/** Per-device cache of the unlocked data key, so unlocking is once per device. */
export interface DekStore {
  read(): Promise<CryptoKey | null>;
  write(dek: CryptoKey): Promise<void>;
  clear(): Promise<void>;
}

const SINGLETON_ID = 'dek';

export function createIndexedDbDekStore(database: VaultKeyDB = createVaultKeyDb()): DekStore {

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
