import { describe, it, expect, vi } from 'vitest';
import { SyncStatusStore } from '../sync-status.store.ts';

describe('SyncStatusStore', () => {
  it('starts idle', () => {
    expect(new SyncStatusStore().get()).toBe('idle');
  });

  it('reports the status it was set to', () => {
    const store = new SyncStatusStore();

    store.set('syncing');

    expect(store.get()).toBe('syncing');
  });

  it('notifies subscribers of a change', () => {
    const store = new SyncStatusStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('offline');

    expect(listener).toHaveBeenCalledOnce();
  });

  it('stays quiet when the status did not actually change', () => {
    // useSyncExternalStore re-reads on every notification, so repeating a status
    // would re-render the whole header for nothing.
    const store = new SyncStatusStore();
    store.set('offline');
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('offline');

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying once unsubscribed', () => {
    const store = new SyncStatusStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set('synced');

    expect(listener).not.toHaveBeenCalled();
  });
});
