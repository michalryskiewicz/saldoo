import { db } from '.';

export type DBMeta = {
  key: string;
  value: string | number;
};

// Helper functions for meta table
export const setLastUpdated = async () => {
  await db.meta.put({ key: 'lastUpdated', value: new Date().getTime() });
};

export const getLastUpdated = async (): Promise<number> => {
  const entry = (await db.meta.get({ key: 'lastUpdated' })) as DBMeta | undefined;
  return typeof entry?.value === 'number' ? entry.value : -1;
};
