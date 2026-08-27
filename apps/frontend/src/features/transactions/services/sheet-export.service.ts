import { db } from '@/database/index.ts';
import type { DBTransaction } from '@/database/transactions.ts';
import type { Locale } from '@/i18n.ts';
import { sheetCsv, type SheetExportRow } from '@/lib/saldoo-sheet/to-csv.ts';

type NamesById = {
  tags: Map<string, string>;
  goals: Map<string, string>;
  expenses: Map<string, string>;
};

/**
 * Payments as sheet rows, with every reference written out as the name it has on screen.
 *
 * Ids for the things the sheet is *about* and names for everything it points at, which is the only
 * combination a person can work with: nobody recognises a uuid for a category, and no import can
 * recognise a transaction without one. The id column is the transaction's own, and the round trip
 * rests on it.
 *
 * A reference whose record has since gone is written as an empty cell rather than as its id — an id
 * in a name column would come back as an unknown name, and the report would blame the person for a
 * cell they never typed.
 */
export const toSheetRows = (
  transactions: readonly DBTransaction[],
  names: NamesById
): SheetExportRow[] =>
  transactions.map((transaction) => ({
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    description: transaction.description,
    amount: transaction.amount,
    currency: transaction.currency,
    category: transaction.tagId ? names.tags.get(transaction.tagId) : undefined,
    goal: transaction.goalId ? names.goals.get(transaction.goalId) : undefined,
    expense: transaction.expenseId ? names.expenses.get(transaction.expenseId) : undefined,
    budgetPart: transaction.strategyPart,
  }));

/**
 * The file itself, read straight out of the local database.
 *
 * A one-shot read rather than a subscription: this runs because somebody pressed a button, and what
 * they get is the data as it stands at that moment. Nothing here goes near the network — the export
 * is written in the browser and saved by the browser, which is the whole claim being kept.
 */
export const sheetForTransactions = async (
  transactions: readonly DBTransaction[],
  locale: Locale
): Promise<string> => {
  const [tags, goals, expenses] = await Promise.all([
    db.tags.toArray(),
    db.goals.toArray(),
    db.expenses.toArray(),
  ]);

  return sheetCsv(
    toSheetRows(transactions, {
      tags: new Map(tags.map((tag) => [tag.id, tag.name])),
      goals: new Map(goals.map((goal) => [goal.id, goal.description])),
      expenses: new Map(expenses.map((expense) => [expense.id, expense.description])),
    }),
    locale
  );
};
