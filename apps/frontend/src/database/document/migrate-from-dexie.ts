import type { AppDB } from '@/database/index.ts';
import type { DocumentSession } from './document-session.ts';
import type { DocumentTable } from './record-codec.ts';

/**
 * Lifts an existing user's rows out of Dexie and into the document, once.
 *
 * Before this runs, Dexie holds the truth and the document is empty. After it, the
 * document holds the truth and Dexie is projected from it. Every existing install is
 * in the first state exactly once.
 *
 * ## Why the marker lives in the document
 *
 * Dexie is a derived read model from here on, so anything recording "migration done"
 * there would be rebuilt or diverge. The marker goes in the document, which is the
 * thing that actually persists and syncs.
 *
 * Without it the migration would re-run on every open and lift rows back out of
 * Dexie — including rows that have since been deleted on another device, which would
 * resurrect exactly what the merge work exists to stop.
 */
const MIGRATED_TABLE: DocumentTable = 'settings';
const MIGRATION_MARKER_ID = '__dexie-migration__';

/** Tables the document owns. `meta` stays in Dexie. */
const MIGRATED_TABLES: readonly DocumentTable[] = [
  'expenses',
  'profits',
  'tags',
  'transactions',
  'duties',
];

export async function migrateFromDexie(session: DocumentSession, database: AppDB): Promise<void> {
  const alreadyMigrated = session
    .records(MIGRATED_TABLE)
    .some((record) => record.id === MIGRATION_MARKER_ID);

  if (alreadyMigrated) return;

  for (const table of MIGRATED_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: object[] = await (database as any)[table].toArray();

    for (const row of rows) {
      // Duties used to be keyed by a random uuid while carrying a deterministic
      // hash, which is why they could not sync: two devices generating the same
      // window produced two rows racing on the unique hash index. Identity is the
      // hash from here on, so existing rows are re-keyed on the way in. The unique
      // index guarantees no two rows share a hash, so this cannot collide.
      const record = table === 'duties' ? { ...row, id: (row as { hash: string }).hash } : row;

      await session.put(table, record);
    }
  }

  await session.put(MIGRATED_TABLE, {
    id: MIGRATION_MARKER_ID,
    migratedAt: Date.now(),
  });
}
