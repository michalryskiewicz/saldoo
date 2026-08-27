import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';
import type { CsvMapping } from '@/lib/banks/mapping.ts';

/**
 * How somebody's own bank writes a statement, in their words.
 *
 * Stored like every other record — in the encrypted document, therefore on their Drive and on their
 * other devices — because a mapping is work. Somebody who described mBank's export on a laptop
 * should not describe it again on a phone, and re-describing it is exactly the moment a column gets
 * picked wrong.
 *
 * It holds no payments and no amounts: which column held the money, never how much was in it.
 */
export type DBCsvMapping = CsvMapping & {
  createdAt: Date;
  updatedAt?: Date;
};

export type CsvMappingDraft = Omit<DBCsvMapping, 'id' | 'createdAt' | 'updatedAt'>;

/** @returns the stored mapping, so the import that prompted it can go straight on and use it. */
export const addDBCsvMapping = async (draft: CsvMappingDraft): Promise<DBCsvMapping | undefined> => {
  try {
    const mapping: DBCsvMapping = { id: uuidv4(), createdAt: new Date(), ...draft };

    await documentSession.put('csvMappings', mapping);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-mapping'));

    return mapping;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-mapping'));

    return undefined;
  }
};

/**
 * @returns whether the write landed.
 *
 * The version goes up with every change, because a mapping is the thing a re-import is read
 * through: told that March came in wrong, the version says whether it was read by the mapping that
 * stands today or by the one before it.
 */
export const updateDBCsvMapping = async (
  id: string,
  draft: CsvMappingDraft
): Promise<boolean> => {
  try {
    await documentSession.update('csvMappings', id, {
      ...draft,
      version: draft.version + 1,
      updatedAt: new Date(),
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.update-mapping'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-mapping'));

    return false;
  }
};

export const deleteDBCsvMapping = async (id: string): Promise<void> => {
  try {
    await documentSession.remove('csvMappings', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-mapping'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-mapping'));
  }
};
