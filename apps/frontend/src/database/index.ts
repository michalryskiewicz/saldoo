import Dexie, { type Table } from 'dexie';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import type { DBMeta } from '@/database/meta.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBTag } from '@/database/tags.ts';

class AppDB extends Dexie {
  expenses!: Table<DBExpense, string>;
  profits!: Table<DBProfit, string>;
  duties!: Table<DBDuty, string>;
  transactions!: Table<DBTransaction, string>;
  tags!: Table<DBTag, string>;
  meta!: Table<DBMeta, unknown>;

  constructor() {
    super('saldoo');
    // Keep version 1 schema for migration path
    this.version(1).stores({
      expenses:
        'id, createdAt, updatedAt, userId, description, expense, currency, severity, frequency, execution, strategyPart, tagId',
      profits:
        'id, createdAt, updatedAt, userId, description, profit, currency, frequency, execution',
      duties:
        'id, createdAt, updatedAt, resolved, ignored, frequency, executionDate, expenseId, transactionId, &hash',
      transactions:
        'id, createdAt, updatedAt, transactionId, sourceBank, amount, currency, transactionDate, description, &hash, expenseId, strategyPart, tagId, duties',
      meta: '&key',
    });

    // Version 2 adds tags table with unique name constraint
    this.version(2).stores({
      expenses:
        'id, createdAt, updatedAt, userId, description, expense, currency, severity, frequency, execution, strategyPart, tagId',
      profits:
        'id, createdAt, updatedAt, userId, description, profit, currency, frequency, execution',
      duties:
        'id, createdAt, updatedAt, resolved, ignored, frequency, executionDate, expenseId, transactionId, &hash',
      transactions:
        'id, createdAt, updatedAt, transactionId, sourceBank, amount, currency, transactionDate, description, &hash, expenseId, strategyPart, tagId, duties',
      tags: 'id, createdAt, updatedAt, userId, &name',
      meta: '&key',
    });
  }
}

export const db = new AppDB();

export const isDatabaseEmpty = async (): Promise<boolean> => {
  const expensesCount = await db.expenses.count();
  const profitsCount = await db.profits.count();
  // Database is empty if all are missing/zero
  return expensesCount === 0 && profitsCount === 0;
};

type TableInJSON<T extends Record<string, unknown>, K extends string> = {
  inbound: boolean;
  tableName: K;
  rows: T[];
};

export type DatabaseType = {
  data: {
    databaseName: string;
    databaseVersion: number;
    data: [
      TableInJSON<DBExpense, 'expenses'>,
      TableInJSON<DBProfit, 'profits'>,
      TableInJSON<DBDuty, 'duties'>,
      TableInJSON<DBTransaction, 'transactions'>,
      TableInJSON<DBTag, 'tags'>,
      TableInJSON<DBMeta, 'meta'>,
    ];
  };
  name: string;
  formatVersion: number;
};
