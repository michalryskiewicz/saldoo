import type { TokenCache, TokenSnapshot } from './drive-token.service.ts';

const STORAGE_KEY = 'saldoo.drive-token';

/**
 * Caches the Drive token in `sessionStorage` so a page reload does not need a
 * round trip to Google. Deliberately not a cookie: it is never attached to a
 * request, it dies with the tab, and it never reaches the server.
 */
export function createSessionTokenCache(storage: Storage = sessionStorage): TokenCache {
  return {
    read() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<TokenSnapshot>;
        if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
          return null;
        }

        return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
      } catch {
        return null;
      }
    },

    write(snapshot) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // A full or unavailable sessionStorage only costs us the reload shortcut.
      }
    },

    clear() {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}
