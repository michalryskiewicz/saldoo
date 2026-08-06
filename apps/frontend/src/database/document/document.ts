import * as Y from 'yjs';
import { type DocumentTable, decodeRecord, encodeRecord } from './record-codec.ts';

/**
 * The Yjs document that holds Saldoo's records.
 *
 * ## Shape, and why
 *
 * One top-level `Y.Map` per table, keyed by record id, whose values are themselves
 * `Y.Map`s of that record's fields:
 *
 * ```
 * expenses: Y.Map {
 *   'e1': Y.Map { id, createdAt, description, expense, ... }
 * }
 * ```
 *
 * A record has to be a nested `Y.Map` rather than a plain object for the property
 * this whole design exists to buy: **field-level concurrency**. Two devices editing
 * different fields of the same expense each touch a different key, so both edits
 * survive. Stored as a plain object the record would be one opaque value and the
 * later write would replace the earlier one wholesale.
 *
 * ## Conflict rules
 *
 * - Two devices writing the **same field**: last writer wins, resolved identically
 *   on every device by Yjs's own ordering — never by wall-clock time.
 * - Two devices writing **different fields**: both survive.
 * - A **delete beats a concurrent edit**. Removing the entry from the table map
 *   removes the child type, so field writes that raced with it are gone with it.
 *   That is Yjs's semantics rather than a choice we made, and it is the safer
 *   direction: a record the user deleted stays deleted.
 *
 * Deletions need no tombstone table of ours — Yjs tracks them internally, which is
 * the single largest reason this replaced a hand-rolled merge engine.
 *
 * Values are always converted through the codec, never written raw: see
 * `record-codec.ts` for why a `Date` must not reach a `Y.Map`.
 */
export function createDocument(): Y.Doc {
  // gc stays on (the default). With it off the document would keep the content of
  // every deleted record forever, and this document is uploaded whole on every sync.
  return new Y.Doc();
}

function tableMap(doc: Y.Doc, table: DocumentTable): Y.Map<Y.Map<unknown>> {
  return doc.getMap(table);
}

/** Inserts or replaces a record. Field values are encoded for the wire. */
export function putRecord(doc: Y.Doc, table: DocumentTable, record: object): void {
  const fields = encodeRecord(table, record);

  doc.transact(() => {
    const target = new Y.Map<unknown>();
    tableMap(doc, table).set((record as { id: string }).id, target);

    for (const [key, value] of Object.entries(fields)) {
      target.set(key, value);
    }
  });
}

/**
 * Writes only the given fields, leaving the rest untouched — the operation that
 * makes concurrent edits to different fields survive each other.
 *
 * A field given as `undefined` is **removed**. Leaving a field alone and saying it
 * no longer applies are different intentions and both have to be expressible: a key
 * that is absent means the former, a key explicitly set to `undefined` the latter.
 * `encodeRecord` drops undefined on its way to the wire — correctly, nothing should
 * carry it — so the removals are read off the fields as given.
 *
 * A no-op when the record is absent: it may have been deleted on another device,
 * and re-creating it from a partial update would resurrect a record the user
 * deleted with most of its fields missing.
 */
export function updateFields(
  doc: Y.Doc,
  table: DocumentTable,
  id: string,
  fields: object,
): void {
  const encoded = encodeRecord(table, fields);
  const cleared = Object.entries(fields)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);

  doc.transact(() => {
    const target = tableMap(doc, table).get(id);
    if (!target) return;

    for (const [key, value] of Object.entries(encoded)) {
      target.set(key, value);
    }

    for (const key of cleared) {
      target.delete(key);
    }
  });
}

export function deleteRecord(doc: Y.Doc, table: DocumentTable, id: string): void {
  doc.transact(() => {
    tableMap(doc, table).delete(id);
  });
}

export function readRecord(
  doc: Y.Doc,
  table: DocumentTable,
  id: string,
): Record<string, unknown> | null {
  const target = tableMap(doc, table).get(id);
  if (!target) return null;

  return decodeRecord(table, target.toJSON());
}

export function readAllRecords(
  doc: Y.Doc,
  table: DocumentTable,
): (Record<string, unknown> & { id: string })[] {
  const records: (Record<string, unknown> & { id: string })[] = [];

  for (const target of tableMap(doc, table).values()) {
    records.push(
      decodeRecord(table, target.toJSON()) as Record<string, unknown> & { id: string },
    );
  }

  return records;
}
