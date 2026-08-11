import Dexie, { type Table } from 'dexie';
import type { DBExpense } from '@/database/expenses.ts';
import type { DBProfit } from '@/database/profits.ts';
import type { DBMeta } from '@/database/meta.ts';
import type { DBDuty } from '@/database/duty.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import type { DBTag } from '@/database/tags.ts';
import type { DBSettings } from '@/database/settings.ts';
import type { DBGoal, DBClosedWindow } from '@/database/goals.ts';
import type { DBContribution } from '@/database/contributions.ts';
import type { DBPosition } from '@/database/positions.ts';
import type { DBValuation } from '@/database/valuations.ts';
import type { DBBondHolding } from '@/database/bonds.ts';

export class AppDB extends Dexie {
  expenses!: Table<DBExpense, string>;
  profits!: Table<DBProfit, string>;
  duties!: Table<DBDuty, string>;
  transactions!: Table<DBTransaction, string>;
  tags!: Table<DBTag, string>;
  meta!: Table<DBMeta, unknown>;
  settings!: Table<DBSettings, string>;
  goals!: Table<DBGoal, string>;
  contributions!: Table<DBContribution, string>;
  closedWindows!: Table<DBClosedWindow, string>;
  positions!: Table<DBPosition, string>;
  valuations!: Table<DBValuation, string>;
  bonds!: Table<DBBondHolding, string>;

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

    // Version 3 moves currency, budgeting strategy and pending actions off the
    // server and into the encrypted backup.
    this.version(3).stores({
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
      settings: '&id',
    });

    // Version 4 adds goals, the contributions made towards them, and the record a yearly goal
    // leaves behind when its window ends.
    this.version(4).stores({
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
      settings: '&id',
      goals: 'id, createdAt, updatedAt, description, currency, strategyPart, deadline, year, seriesId, closedAt',
      contributions: 'id, createdAt, updatedAt, goalId, contributedAt, transactionId',
      closedWindows: 'id, createdAt, goalId, seriesId, year',
    });

    // Version 5 adds the things a person holds or owes, which net worth is the sum of.
    this.version(5).stores({
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
      settings: '&id',
      goals: 'id, createdAt, updatedAt, description, currency, strategyPart, deadline, year, seriesId, closedAt',
      contributions: 'id, createdAt, updatedAt, goalId, contributedAt, transactionId',
      closedWindows: 'id, createdAt, goalId, seriesId, year',
      positions: 'id, createdAt, updatedAt, description, kind, currency, valuedOn',
    });

    // Version 6 adds retail treasury bonds, whose value is computed rather than stated.
    this.version(6).stores({
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
      settings: '&id',
      goals: 'id, createdAt, updatedAt, description, currency, strategyPart, deadline, year, seriesId, closedAt',
      contributions: 'id, createdAt, updatedAt, goalId, contributedAt, transactionId',
      closedWindows: 'id, createdAt, goalId, seriesId, year',
      positions: 'id, createdAt, updatedAt, description, kind, currency, valuedOn',
      bonds: 'id, createdAt, updatedAt, description, boughtOn, currency',
    });

    // Version 7 keeps what a holding was worth before. The position itself cannot: it holds one
    // value and one date, so every re-valuation overwrote the only record of the last one — and a
    // holding whose worth nobody can compare with anything is a holding nobody can say grew.
    //
    // Its own table rather than a list on the position, because the document codec knows about date
    // fields at the top level of a row and nowhere else: dates nested in an array cross the wire as
    // `{}` while reading back correctly on the device that wrote them.
    this.version(7).stores({
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
      settings: '&id',
      goals: 'id, createdAt, updatedAt, description, currency, strategyPart, deadline, year, seriesId, closedAt',
      contributions: 'id, createdAt, updatedAt, goalId, contributedAt, transactionId',
      closedWindows: 'id, createdAt, goalId, seriesId, year',
      positions: 'id, createdAt, updatedAt, description, kind, currency, valuedOn',
      bonds: 'id, createdAt, updatedAt, description, boughtOn, currency',
      valuations: 'id, createdAt, positionId, valuedOn, currency',
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
      TableInJSON<DBSettings, 'settings'>,
    ];
  };
  name: string;
  formatVersion: number;
};
