import type { Currency, FREQUENCY } from '@/constant.ts';
import { db } from '@/database/index.ts';
import { v4 as uuidv4 } from 'uuid';
import { vaultDriveSync } from '@/database/sync/sync.container.ts';
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

export const addDBProfit = async (profit: ProfitCreateSchema) => {
  try {
    await db.profits.add({
      id: uuidv4(),
      createdAt: new Date(),
      ...profit,
      currency: profit.currency as Currency,
      frequency: profit.frequency as FREQUENCY,
    });
    await setLastUpdated();
    await vaultDriveSync.exportToDrive();
    toast(i18n.t('success.create-profit'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-profit'));
  }
};

export const updateDBProfit = async (id: string, profit: ProfitCreateSchema) => {
  try {
    await db.profits.update(id, {
      ...profit,
      updatedAt: new Date(),
      currency: profit.currency as Currency,
      frequency: profit.frequency as FREQUENCY,
    });
    await setLastUpdated();
    await vaultDriveSync.exportToDrive();
    toast(i18n.t('success.update-profit'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-profit'));
  }
};

export const deleteDBProfit = async (id: string) => {
  try {
    await db.profits.delete(id);
    await setLastUpdated();
    await vaultDriveSync.exportToDrive();
    toast(i18n.t('success.deleted-profit'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-profit'));
  }
};
