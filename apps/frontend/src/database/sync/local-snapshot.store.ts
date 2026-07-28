import { exportDB, importInto } from 'dexie-export-import';
import { db, isDatabaseEmpty } from '@/database/index.ts';
import { getLastUpdated } from '@/database/meta.ts';

/** The local database as the sync layer sees it: a snapshot in, a snapshot out. */
export interface LocalSnapshotStore {
  isEmpty(): Promise<boolean>;
  lastUpdated(): Promise<number>;
  exportSnapshot(): Promise<string>;
  importSnapshot(snapshotJson: string): Promise<void>;
}

export function createDexieSnapshotStore(): LocalSnapshotStore {
  return {
    isEmpty: isDatabaseEmpty,
    lastUpdated: getLastUpdated,

    async exportSnapshot() {
      return (await exportDB(db)).text();
    },

    async importSnapshot(snapshotJson) {
      await importInto(db, new Blob([snapshotJson], { type: 'application/json' }), {
        overwriteValues: true,
      });
    },
  };
}
