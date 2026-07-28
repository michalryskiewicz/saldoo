import { createVaultKeyDb, type VaultKeyDB } from '@/crypto/vault-key-db.ts';
import type { Keyfile } from '@/crypto/vault.service.ts';

/**
 * The last keyfile this device saw on Drive.
 *
 * Its only job is to answer "does a vault exist?" when Drive cannot be asked, so
 * that being offline never looks like having no vault.
 */
export interface KeyfileCache {
  read(): Promise<Keyfile | null>;
  write(keyfile: Keyfile): Promise<void>;
  clear(): Promise<void>;
}

const SINGLETON_ID = 'keyfile';

export function createIndexedDbKeyfileCache(
  database: VaultKeyDB = createVaultKeyDb()
): KeyfileCache {
  return {
    async read() {
      const stored = await database.keyfiles.get(SINGLETON_ID);
      return stored?.keyfile ?? null;
    },

    async write(keyfile) {
      await database.keyfiles.put({ id: SINGLETON_ID, keyfile });
    },

    async clear() {
      await database.keyfiles.delete(SINGLETON_ID);
    },
  };
}
