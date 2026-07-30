import { db } from '@/database/index.ts';
import { setLastUpdated } from '@/database/meta.ts';
import { withSettingsDefaults, type Settings } from '@/database/settings.service.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';

const SETTINGS_ID = 'settings';

export type DBSettings = Settings & { id: string };

export const getSettings = async (): Promise<Settings> =>
  withSettingsDefaults(await db.settings.get(SETTINGS_ID));

/** Merges a patch into the stored settings and pushes the result to Drive. */
export const saveSettings = async (patch: Partial<Settings>): Promise<void> => {
  const current = await getSettings();

  await documentSession.put('settings', { id: SETTINGS_ID, ...current, ...patch });
  await setLastUpdated();
  outbox.markDirty();
};
