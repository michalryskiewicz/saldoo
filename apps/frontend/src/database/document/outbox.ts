import type { OutboxStore } from './outbox-store.ts';

/**
 * Uploads the current document state. Throws to report failure, and the error decides
 * whether the outbox keeps trying: an error carrying `transient: true` will be
 * retried, anything else is treated as permanent and stops the loop.
 *
 * Classifying the failure belongs with whatever knows Drive — the outbox deliberately
 * knows nothing about HTTP.
 */
export type Uploader = () => Promise<void>;

export type OutboxFailure = 'transient' | 'permanent';

export type OutboxState = {
  /** There is work Drive has not accepted yet. */
  pending: boolean;
  failure?: OutboxFailure;
};

export interface Outbox {
  /**
   * Records that the document changed. **Synchronous by contract** — a mutator must
   * be able to report success without waiting for the network, which is the whole
   * point: today every mutator awaits the upload inside the same `try/catch` as the
   * local write, so an offline user is told their expense could not be added while
   * the record is sitting safely in IndexedDB.
   */
  markDirty(): void;
  /** Picks up work left unsent by a previous run. */
  restore(): Promise<void>;
  state(): OutboxState;
  subscribe(listener: () => void): () => void;
}

/**
 * Debounce before uploading. Long enough that a burst — typing through a form, or a
 * CSV import writing row after row — becomes one upload; short enough that a user who
 * makes one change and closes the tab does not lose it.
 */
export const UPLOAD_DEBOUNCE_MS = 2_000;

/** First retry delay; doubles each attempt up to the ceiling. */
const RETRY_BASE_MS = 5_000;
const RETRY_CEILING_MS = 5 * 60_000;

function isTransient(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'transient' in error
    ? (error as { transient?: unknown }).transient === true
    : false;
}

export function createOutbox({
  store,
  upload,
  schedule,
}: {
  store: OutboxStore;
  upload: Uploader;
  /** Injected so backoff can be asserted in tests instead of waited out. */
  schedule: (delayMs: number, run: () => void) => void;
}): Outbox {
  let pending = false;
  let failure: OutboxFailure | undefined;
  let attempts = 0;
  let draining = false;
  let scheduled = false;
  const listeners = new Set<() => void>();

  /**
   * A stable snapshot, replaced only when the state really changes.
   *
   * `useSyncExternalStore` compares snapshots by reference, so building a fresh object
   * per read makes React re-render forever — it warns "getSnapshot should be cached to
   * avoid an infinite loop" and then throws "Maximum update depth exceeded".
   */
  let snapshot: OutboxState = { pending, failure };

  const notify = () => {
    snapshot = { pending, failure };
    for (const listener of listeners) listener();
  };

  const scheduleDrain = (delayMs: number) => {
    if (scheduled) return;
    scheduled = true;

    schedule(delayMs, () => {
      scheduled = false;
      void drain();
    });
  };

  const drain = async () => {
    // One upload at a time. Two concurrent uploads would race on the same Drive file,
    // and the later-finishing one could carry the older state.
    if (draining || !pending) return;
    draining = true;

    try {
      await upload();

      pending = false;
      failure = undefined;
      attempts = 0;
      // Notify before persisting: the indicator reflects state, and making it wait
      // on IndexedDB would show a stale "pending" for no reason.
      notify();

      await store.write(false);
    } catch (error) {
      if (isTransient(error)) {
        attempts += 1;
        failure = 'transient';
        notify();
        scheduleDrain(Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_CEILING_MS));
      } else {
        // Retrying cannot clear this — an unreadable backup or a rejected precondition
        // needs the user to act, and hammering Drive meanwhile helps nobody.
        failure = 'permanent';
        notify();
      }
    } finally {
      draining = false;
    }
  };

  return {
    markDirty() {
      pending = true;
      failure = undefined;
      attempts = 0;

      // Fire-and-forget: the flag only has to survive a reload, and waiting on
      // IndexedDB here would make this asynchronous for no benefit.
      void store.write(true);

      notify();
      scheduleDrain(UPLOAD_DEBOUNCE_MS);
    },

    async restore() {
      if (!(await store.read())) return;

      pending = true;
      notify();
      scheduleDrain(UPLOAD_DEBOUNCE_MS);
    },

    state() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
