const STORAGE_KEY = 'saldoo.login-hint';

export interface LoginHintStore {
  read(): string | null;
  remember(email: string): void;
  /** What switching account means: stop aiming at the last one. */
  forget(): void;
}

/**
 * Remembers which account this device signs in as.
 *
 * Handed to Google as `login_hint`, which skips the account chooser — and, more than a
 * convenience, aims *silent* renewal at the right account. Without it a background
 * renewal takes whichever account the browser happens to have active, and picking the
 * wrong one finds no keyfile and reads to the user as a broken vault.
 *
 * Deliberately `localStorage` and not the session: the hint has to be there on a device
 * whose browser was closed, which is the only time it is needed. An email address is a
 * trace, not a credential — no token and no key live here.
 */
export function createLoginHintStore(storage: Storage = localStorage): LoginHintStore {
  return {
    read() {
      try {
        return storage.getItem(STORAGE_KEY) || null;
      } catch {
        return null;
      }
    },

    remember(email) {
      if (!email) return;

      try {
        storage.setItem(STORAGE_KEY, email);
      } catch {
        // Only costs the chooser being shown next time.
      }
    },

    forget() {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}

export const loginHintStore = createLoginHintStore();
