import { createVaultKeyDb, type VaultKeyDB } from './vault-key-db.ts';

/**
 * Keeps the unlocked data key across a **reload**, but not across closing the browser.
 *
 * ## The trade this makes
 *
 * The vault previously kept the key in memory only, so every reload cost a passphrase
 * entry and a second of PBKDF2 — accurate to the threat model and genuinely unpleasant
 * to use. Keeping it forever on disk is the other extreme, and is what made a stolen
 * unlocked laptop worth something.
 *
 * This sits between them, and the split is deliberate:
 *
 * - **Reload keeps the key.** `sessionStorage` survives F5 and in-tab navigation, so a
 *   witness stored there proves we are still inside the browser session that unlocked.
 * - **Closing the browser loses it.** `sessionStorage` is cleared, the witness is gone,
 *   and the key is refused *and deleted* — so the passphrase is required again, which is
 *   the property that makes a recovered machine useless.
 * - **And it expires anyway.** A browser left open for days is not a session anybody
 *   meant to keep, so the key is refused past a maximum age regardless of the witness.
 *
 * The stored key stays **non-extractable**, exactly as before: a script in this origin
 * can use it while the tab lives, and can never carry it away. That property is
 * unaffected by where the key is kept, which is why this trade is about theft of the
 * machine rather than about injection.
 *
 * The idle lock is untouched and still clears both memory and this cache.
 */
export interface SessionKeyCache {
  /** The cached key, or `null` when there is none this session may use. */
  read(): Promise<CryptoKey | null>;
  write(dek: CryptoKey): Promise<void>;
  clear(): Promise<void>;
}

/** Present only while the browser session that unlocked the vault is still alive. */
export const SESSION_WITNESS_KEY = 'saldoo.vault-session';

/** A browser left open for days was not a deliberate session. */
export const MAX_CACHE_AGE_MS = 8 * 60 * 60 * 1000;

const CACHE_ID = 'session-dek';

export function createSessionKeyCache({
  database = createVaultKeyDb(),
  now = () => Date.now(),
}: {
  database?: VaultKeyDB;
  now?: () => number;
} = {}): SessionKeyCache {
  const clear = async () => {
    sessionStorage.removeItem(SESSION_WITNESS_KEY);
    await database.sessionKeys.delete(CACHE_ID);
  };

  return {
    async read() {
      const witness = sessionStorage.getItem(SESSION_WITNESS_KEY);
      const stored = await database.sessionKeys.get(CACHE_ID);

      if (!stored) return null;

      // No witness means a different browser session — a restart, or another window
      // opened after this one closed. Delete rather than merely refuse: a key nobody
      // is allowed to use is a liability sitting on disk.
      if (!witness || witness !== stored.witness) {
        await clear();
        return null;
      }

      if (now() - stored.createdAt > MAX_CACHE_AGE_MS) {
        await clear();
        return null;
      }

      return stored.dek;
    },

    async write(dek) {
      // A fresh witness per unlock, so a stale row can never be matched by a witness
      // left behind from an earlier one.
      const witness = crypto.randomUUID();

      sessionStorage.setItem(SESSION_WITNESS_KEY, witness);
      // The CryptoKey itself is stored, not its bytes — structured clone keeps it a
      // non-extractable key rather than turning it into material anything can read.
      await database.sessionKeys.put({ id: CACHE_ID, dek, witness, createdAt: now() });
    },

    clear,
  };
}
