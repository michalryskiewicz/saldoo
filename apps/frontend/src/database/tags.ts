import { db } from '@/database/index.ts';
import { v4 as uuidv4 } from 'uuid';
import { googleDriveSync } from '@/database/sync/google-drive-sync.ts';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { setLastUpdated } from '@/database/meta.ts';

export type DBTag = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  userId?: string;
};

export const addDBTags = async (names: string[], userId?: string) => {
  try {
    const tags = names.map((name) => ({
      id: uuidv4(),
      createdAt: new Date(),
      name,
      userId,
    }));
    await db.tags.bulkAdd(tags);
    await setLastUpdated();
    await googleDriveSync.exportToDrive();
    toast(i18n.t('success.create-tags', { count: names.length }));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-tags'));
  }
};

export const removeDBTags = async (names: string[]) => {
  try {
    const tagsToDelete = await db.tags.where('name').anyOf(names).toArray();
    const ids = tagsToDelete.map((tag) => tag.id);
    await db.tags.bulkDelete(ids);
    await setLastUpdated();
    await googleDriveSync.exportToDrive();
    toast(i18n.t('success.deleted-tags', { count: names.length }));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-tags'));
  }
};
