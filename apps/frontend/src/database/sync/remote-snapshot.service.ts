import type { DatabaseType } from '@/database/index.ts';
import { NO_REMOTE_TIMESTAMP } from '@/database/sync/sync-decision.service.ts';

/**
 * Digs the logical revision out of a decrypted Dexie export.
 *
 * Drive's own `modifiedTime` cannot stand in for this: it records when the file was
 * written, which says nothing about which device's data is actually newer once two
 * devices with skewed clocks are in play.
 *
 * @returns the `lastUpdated` stamp, or {@link NO_REMOTE_TIMESTAMP} for anything
 * that cannot be read as a Saldoo export.
 */
export function readLastUpdatedFromSnapshot(snapshotJson: string): number {
  let parsed: DatabaseType;
  try {
    parsed = JSON.parse(snapshotJson) as DatabaseType;
  } catch {
    return NO_REMOTE_TIMESTAMP;
  }

  const metaRows = parsed?.data?.data?.find((table) => table.tableName === 'meta')?.rows;
  const lastUpdated = metaRows?.find((row) => row.key === 'lastUpdated')?.value;

  return typeof lastUpdated === 'number' ? lastUpdated : NO_REMOTE_TIMESTAMP;
}
