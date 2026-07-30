import type * as Y from 'yjs';
import type { AppDB } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBTag } from '@/database/tags.ts';
import { type DocumentTable, decodeRecord } from './record-codec.ts';

/**
 * Keeps Dexie in step with the document.
 *
 * The document is the source of truth; Dexie is a **derived read model** that exists
 * so the app's existing `useLiveQuery` hooks keep working unchanged.
 *
 * ## Why this is per-record and never rebuilds a table
 *
 * Rebuilding (`table.clear()` then `bulkPut`) would be simpler and is wrong twice
 * over:
 *
 * 1. `useLiveQuery` observes the clear and emits `[]`, so every list flashes empty on
 *    every change, and the single-record reads in the create/edit forms momentarily
 *    return `undefined`, resetting a form the user is typing into.
 * 2. A rebuild would drop and re-add rows the user is looking at, so anything derived
 *    from them re-renders for no reason.
 *
 * So only the records that actually changed are touched, and only in the tables the
 * document owns.
 */
export interface Projector {
  start(): void;
  stop(): void;
  /** Resolves once every projection queued so far has been written. */
  settled(): Promise<void>;
}

/** The tables the document owns. `meta` is deliberately absent — it stays local. */
const PROJECTED_TABLES: readonly DocumentTable[] = [
  'expenses',
  'profits',
  'tags',
  'transactions',
  'duties',
];

/** Exactly the callback shape `Y.Map.observeDeep` declares, so no `any` is needed. */
type DeepObserver = Parameters<Y.Map<unknown>['observeDeep']>[0];

export function createProjector(doc: Y.Doc, database: AppDB): Projector {
  const observers = new Map<DocumentTable, DeepObserver>();
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (work: () => Promise<void>) => {
    queue = queue.then(work).catch((error) => {
      // A projection failure must not wedge the queue; the document is still the
      // truth and the next change will re-project the affected records.
      console.error('Projection failed', error);
    });
  };

  const table = (name: DocumentTable) => doc.getMap<Y.Map<unknown>>(name);

  const readFromDocument = (name: DocumentTable, id: string): Record<string, unknown> | null => {
    const record = table(name).get(id);
    return record ? decodeRecord(name, record.toJSON()) : null;
  };

  /**
   * Rebuilds the denormalised copies the codec strips before a record reaches the
   * document. The document stores `expenseId` / `tagId`; consumers still read
   * `transaction.expense` and `transaction.tag`.
   */
  const withRelations = (name: DocumentTable, row: Record<string, unknown>) => {
    if (name !== 'transactions' && name !== 'duties') return row;

    const expenseId = row.expenseId as string | undefined;
    const tagId = row.tagId as string | undefined;

    return {
      ...row,
      ...(expenseId
        ? { expense: readFromDocument('expenses', expenseId) as DBExpense | null ?? undefined }
        : {}),
      ...(tagId ? { tag: readFromDocument('tags', tagId) as DBTag | null ?? undefined } : {}),
    };
  };

  const project = async (name: DocumentTable, ids: Iterable<string>) => {
    const upserts: Record<string, unknown>[] = [];
    const deletions: string[] = [];

    for (const id of ids) {
      const row = readFromDocument(name, id);
      if (row) upserts.push(withRelations(name, row));
      else deletions.push(id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (database as any)[name];
    if (upserts.length) await target.bulkPut(upserts);
    if (deletions.length) await target.bulkDelete(deletions);
  };

  return {
    start() {
      for (const name of PROJECTED_TABLES) {
        const observer: DeepObserver = (events) => {
          // Deep, not shallow: a field edit happens on the record's own nested
          // Y.Map, so observing the table map alone would miss every update and
          // only catch records being added or removed.
          //
          // `event.changes` is readable only while the handler is on the stack
          // (Yjs throws "You must not compute changes after the event-handler
          // fired"), so ids are captured here and the write is queued with the
          // captured copy.
          const changed = new Set<string>();

          for (const event of events) {
            if (event.target === table(name)) {
              for (const id of event.changes.keys.keys()) changed.add(id);
            } else {
              const [id] = event.path;
              if (typeof id === 'string') changed.add(id);
            }
          }

          const ids = [...changed];
          enqueue(() => project(name, ids));
        };

        table(name).observeDeep(observer);
        observers.set(name, observer);

        // Whatever the document already holds — a reload restores it before the app
        // renders, so this is the first thing the read model needs. The key list is
        // captured now rather than inside the queued closure: read lazily it would
        // pick up records added after `stop()` and write them anyway.
        const initial = [...table(name).keys()];
        enqueue(() => project(name, initial));
      }
    },

    stop() {
      for (const [name, observer] of observers) {
        table(name).unobserveDeep(observer);
      }
      observers.clear();
    },

    async settled() {
      // Two hops: the first drains what is queued, the second drains anything those
      // writes queued in turn.
      await queue;
      await queue;
    },
  };
}
