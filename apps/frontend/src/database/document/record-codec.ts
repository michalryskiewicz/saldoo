/**
 * Translates between a Dexie record and the shape the Yjs document can carry.
 *
 * ## Why this exists
 *
 * Yjs encodes `Number | Object | Boolean | Array | String | Uint8Array | Y.Doc |
 * AbstractType`. A `Date` is none of those. It does **not** throw — it falls through
 * to lib0's `writeAny`, which sees a plain object with no own enumerable keys and
 * writes `{}`. Until the state is serialised, Yjs hands back the JS value it is
 * holding, so a `Date` written into a `Y.Map` reads back correctly **on the device
 * that wrote it** and arrives as `{}` everywhere else.
 *
 * Measured on `yjs@13.6.31`:
 *
 * ```
 * rec.set('createdAt', new Date(...))  → accepted, no error
 * rec.get('createdAt')                 → 2026-01-02T03:04:05.000Z
 * after encodeStateAsUpdate → applyUpdate:
 *   createdAt → {}
 * ```
 *
 * So dates cross the wire as epoch milliseconds and are rebuilt on the way out.
 * Any test for this must round-trip through `Y.encodeStateAsUpdate` /
 * `Y.applyUpdate`; an in-memory read passes while the data is being destroyed.
 */

export type DocumentTable =
  | 'expenses'
  | 'profits'
  | 'tags'
  | 'transactions'
  | 'duties'
  | 'goals'
  | 'contributions'
  | 'closedWindows'
  | 'positions'
  | 'valuations'
  | 'bonds'
  | 'settings';

/** Fields held as `Date` in Dexie and as epoch milliseconds in the document. */
const DATE_FIELDS: Record<DocumentTable, readonly string[]> = {
  expenses: ['createdAt', 'updatedAt', 'execution', 'endsAt'],
  profits: ['createdAt', 'updatedAt', 'execution', 'endsAt'],
  tags: ['createdAt', 'updatedAt'],
  transactions: ['createdAt', 'updatedAt'],
  duties: ['createdAt', 'updatedAt', 'executionDate'],
  goals: ['createdAt', 'updatedAt', 'deadline', 'closedAt'],
  contributions: ['createdAt', 'updatedAt', 'contributedAt'],
  closedWindows: ['createdAt', 'openedOn', 'closedOn'],
  positions: ['createdAt', 'updatedAt', 'valuedOn'],
  valuations: ['createdAt', 'valuedOn'],
  bonds: ['createdAt', 'updatedAt', 'boughtOn'],
  settings: [],
};

/**
 * Denormalised copies of another table's row. The document stores the reference
 * (`expenseId`, `tagId`) and never the copy: a copy would carry its own nested
 * dates, and it goes stale the moment the referenced record is edited on another
 * device. The projector rehydrates them from the referenced record.
 */
const DENORMALISED_FIELDS: Record<DocumentTable, readonly string[]> = {
  expenses: [],
  profits: [],
  tags: [],
  transactions: ['expense', 'tag'],
  duties: ['expense', 'transaction'],
  goals: [],
  contributions: [],
  closedWindows: [],
  positions: [],
  valuations: [],
  bonds: [],
  settings: [],
};

/**
 * Fields whose value is arbitrary user-supplied data rather than a known shape, so
 * they travel as a JSON string. `rawData` is an imported CSV row; encoding it
 * structurally would put whatever a bank put in the file in front of lib0.
 */
const JSON_FIELDS: Record<DocumentTable, readonly string[]> = {
  expenses: [],
  profits: [],
  tags: [],
  transactions: ['rawData'],
  duties: [],
  goals: [],
  contributions: [],
  closedWindows: [],
  positions: [],
  valuations: [],
  bonds: [],
  settings: [],
};

export function encodeRecord(table: DocumentTable, record: object): Record<string, unknown> {
  const dateFields = DATE_FIELDS[table];
  const dropped = DENORMALISED_FIELDS[table];
  const jsonFields = JSON_FIELDS[table];
  const encoded: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (dropped.includes(key)) continue;
    if (value === undefined) continue;

    if (dateFields.includes(key)) {
      encoded[key] = value instanceof Date ? value.getTime() : value;
      continue;
    }

    if (jsonFields.includes(key)) {
      encoded[key] = JSON.stringify(value);
      continue;
    }

    encoded[key] = value;
  }

  return encoded;
}

export function decodeRecord(
  table: DocumentTable,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const dateFields = DATE_FIELDS[table];
  const jsonFields = JSON_FIELDS[table];
  const decoded: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    if (dateFields.includes(key)) {
      decoded[key] = typeof value === 'number' ? new Date(value) : value;
      continue;
    }

    if (jsonFields.includes(key)) {
      decoded[key] = typeof value === 'string' ? JSON.parse(value) : value;
      continue;
    }

    decoded[key] = value;
  }

  return decoded;
}
