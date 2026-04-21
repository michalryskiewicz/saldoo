import type { Currency, FREQUENCY, SEVERITY, STRATEGY_PART } from '@/constant.ts';
import { db } from '@/database/index.ts';
import { v4 as uuidv4 } from 'uuid';
import type { ExpenseCreateType } from '@/features/expenses/components/expenses-create.tsx';
import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { googleDriveSync } from '@/database/sync/google-drive-sync.ts';
import { setLastUpdated } from '@/database/meta.ts';

export type DBExpense = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  userId?: string;
  description: string;
  expense: number;
  currency: Currency;
  severity: SEVERITY | null;
  frequency?: FREQUENCY;
  execution?: Date;
  strategyPart?: STRATEGY_PART;
  tagId?: string;
};

export const addDBExpense = async (expense: ExpenseCreateType) => {
  try {
    await db.expenses.add({
      id: uuidv4(),
      createdAt: new Date(),
      ...expense,
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
      frequency: expense.frequency as FREQUENCY,
      strategyPart: expense.strategyPart as STRATEGY_PART,
    });
    await setLastUpdated();
    await googleDriveSync.exportToDrive();
    toast(i18n.t('success.create-expense'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.create-expense'));
  }
};

export const updateDBExpense = async (id: string, expense: ExpenseCreateType) => {
  try {
    await db.expenses.update(id, {
      ...expense,
      updatedAt: new Date(),
      currency: expense.currency as Currency,
      severity: expense.severity as SEVERITY,
      frequency: expense.frequency as FREQUENCY,
      strategyPart: expense.strategyPart as STRATEGY_PART,
    });
    await setLastUpdated();
    await googleDriveSync.exportToDrive();
    toast(i18n.t('success.update-expense'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.update-expense'));
  }
};

export const deleteDBExpense = async (id: string) => {
  try {
    await db.expenses.delete(id);
    await setLastUpdated();
    await googleDriveSync.exportToDrive();
    toast(i18n.t('success.deleted-expense'));
  } catch (e) {
    console.error(e);
    toast(i18n.t('errors.deleted-expense'));
  }
};
