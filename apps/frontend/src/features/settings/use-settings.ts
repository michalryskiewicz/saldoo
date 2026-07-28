import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '@/database/settings.ts';
import type { Settings } from '@/database/settings.service.ts';

/**
 * Reads the user's settings straight from the local database.
 *
 * Live rather than fetched: settings are part of the encrypted backup, so a sync
 * that pulls a newer copy from Drive must be reflected without a refetch.
 */
export function useSettings(): { settings: Settings | undefined; isLoading: boolean } {
  const settings = useLiveQuery(getSettings, [], undefined);

  return { settings, isLoading: settings === undefined };
}
