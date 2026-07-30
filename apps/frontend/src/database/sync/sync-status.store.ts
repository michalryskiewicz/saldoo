export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'blocked'
  | 'unreadable-backup';

type Listener = () => void;

/**
 * Where this device stands with the backup on Drive.
 *
 * Sync no longer holds the app hostage, so this is the only thing telling the user
 * whether their last change reached Drive. It is observable rather than React
 * state because the sync that updates it runs outside the component tree.
 */
export class SyncStatusStore {
  private status: SyncStatus = 'idle';
  private readonly listeners = new Set<Listener>();

  get(): SyncStatus {
    return this.status;
  }

  set(status: SyncStatus): void {
    if (status === this.status) return;

    this.status = status;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const syncStatusStore = new SyncStatusStore();
