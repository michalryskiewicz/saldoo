export class VaultLockedError extends Error {
  constructor() {
    super('The vault is locked — no data key is available');
    this.name = 'VaultLockedError';
  }
}

type Listener = () => void;

/**
 * Holds the unlocked data key for the lifetime of the session.
 *
 * Memory only, and deliberately so: the key is the one secret that must never be
 * written anywhere the server, Drive, or another origin could reach. Locking is
 * therefore as simple as dropping the reference.
 */
export class VaultSession {
  private dek: CryptoKey | null = null;
  private readonly listeners = new Set<Listener>();

  unlock(dek: CryptoKey): void {
    this.dek = dek;
    this.notify();
  }

  lock(): void {
    if (!this.dek) return;
    this.dek = null;
    this.notify();
  }

  isUnlocked(): boolean {
    return this.dek !== null;
  }

  /**
   * @throws {VaultLockedError} when called before the user has unlocked — callers
   * should treat this as "show the unlock screen", not as a failure.
   */
  requireDek(): CryptoKey {
    if (!this.dek) throw new VaultLockedError();
    return this.dek;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const vaultSession = new VaultSession();
