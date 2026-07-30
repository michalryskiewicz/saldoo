import type { AppDB } from '@/database/index.ts';

/**
 * Removes duty rows still keyed by the random uuid they were created with.
 *
 * A duty's identity is its `hash`, so the projector writes each one back under that
 * key. A leftover uuid-keyed row carries the same hash, and the unique index on `hash`
 * rejects the new one — every duty then fails with a `ConstraintError` and none reach
 * Dexie at all.
 *
 * Deliberately **not** part of the one-time Dexie migration, and deliberately
 * idempotent. The migration marks itself done before anything projects, and the
 * projector swallows its failures so as not to wedge the queue, so a device that
 * already ran the migration against a version without this cleanup is left marked
 * "migrated" with the stale rows still in place and no second chance to fix it. This
 * runs on every open instead, and does nothing once there is nothing to drop.
 */
export async function dropStaleDutyKeys(database: AppDB): Promise<number> {
  const stale = (await database.duties.toArray())
    .filter((duty) => duty.id !== duty.hash)
    .map((duty) => duty.id);

  if (stale.length) await database.duties.bulkDelete(stale);

  return stale.length;
}
