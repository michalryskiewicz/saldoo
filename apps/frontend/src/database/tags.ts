import { db } from '@/database/index.ts';
import { v4 as uuidv4 } from 'uuid';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
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
    for (const tag of tags) await documentSession.put('tags', tag);
    await setLastUpdated();
    outbox.markDirty();
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
    for (const id of ids) await documentSession.remove('tags', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-tags', { count: names.length }));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-tags'));
  }
};
