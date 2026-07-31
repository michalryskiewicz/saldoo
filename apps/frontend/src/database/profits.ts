import type { Currency, FREQUENCY } from '@/constant.ts';
import { v4 as uuidv4 } from 'uuid';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import type { ProfitCreateSchema } from '@/features/profits/components/profits-create.tsx';
import { setLastUpdated } from '@/database/meta.ts';

export type DBProfit = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  userId?: string;
  description: string;
  profit: number;
  currency: Currency;
  frequency?: FREQUENCY;
  execution?: Date;
};

/**
 * @returns whether the write landed. Callers close a drawer on the strength of this: reporting
 * nothing made a save that never happened look exactly like one that did, and the only
 * difference was a toast that is easy to miss.
 */
export const addDBProfit = async (profit: ProfitCreateSchema) => {
  try {
    await documentSession.put('profits', {
      id: uuidv4(),
      createdAt: new Date(),
      ...profit,
      currency: profit.currency as Currency,
      frequency: profit.frequency as FREQUENCY,
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.create-profit'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-profit'));

    return false;
  }
};

/**
 * @returns whether the write landed. Callers close a drawer on the strength of this: reporting
 * nothing made a save that never happened look exactly like one that did, and the only
 * difference was a toast that is easy to miss.
 */
export const updateDBProfit = async (id: string, profit: ProfitCreateSchema) => {
  try {
    await documentSession.update('profits', id, {
      ...profit,
      updatedAt: new Date(),
      currency: profit.currency as Currency,
      frequency: profit.frequency as FREQUENCY,
    });
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.update-profit'));

    return true;
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-profit'));

    return false;
  }
};

export const deleteDBProfit = async (id: string) => {
  try {
    await documentSession.remove('profits', id);
    await setLastUpdated();
    outbox.markDirty();
    toast(i18n.t('success.deleted-profit'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-profit'));
  }
};
