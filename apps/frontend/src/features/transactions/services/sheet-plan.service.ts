import type { Currency, STRATEGY_PART } from '@/constant.ts';
import { parseAmount } from '@/lib/banks/statement.ts';
import { parseStatementDate } from '@/lib/banks/mapping.ts';
import { budgetPartFrom, normaliseCell } from '@/lib/saldoo-sheet/format.ts';
import type { SheetField, SheetRow } from '@/lib/saldoo-sheet/read.ts';

/**
 * What one of our own sheets asks the database to do, decided before anything is written.
 *
 * The whole of the round trip's judgement lives here and none of it touches Dexie: which row is an
 * edit and which is a new payment, which edit is refused because a bank stated the figure, which
 * name matches nothing. A plan is a value, so every one of those rules is a unit test rather than a
 * screen somebody has to drive.
 */

/** Why a row, or one field of it, was not applied. */
export type SheetRefusalReason =
  /** Two rows in one file naming the same record. Neither is applied — see below. */
  | 'duplicate-id'
  | 'no-date'
  | 'unreadable-amount'
  | 'unknown-currency'
  /** No category, goal or cost of that name. */
  | 'unknown-name'
  /** More than one of them has that name, and picking one would be a guess. */
  | 'ambiguous-name'
  | 'unknown-budget-part'
  /** An edit to what a bank stated: the date, description, amount or currency of an imported row. */
  | 'bank-fact-edited'
  /** A row marked for deletion that names no record we hold. */
  | 'nothing-to-delete';

export type SheetRefusal = {
  row: number;
  reason: SheetRefusalReason;
  /** Which column it is about, where more than one could be. */
  field?: SheetField;
  /**
   * The cell as the file wrote it.
   *
   * On the screen, because "no category of that name" is useless without the name. Never in the
   * copyable report — that is a file somebody sends us, and a category name is theirs.
   */
  value?: string;
};

/** What a payment is filed against. Every one of these may be cleared by emptying its cell. */
type Attribution = {
  tagId?: string;
  goalId?: string;
  expenseId?: string;
  strategyPart?: STRATEGY_PART;
};

/** What a bank states, and what only a row nobody's bank wrote may change. */
type Stated = {
  transactionDate?: string;
  description?: string;
  amount?: number;
  currency?: Currency;
};

export type SheetInsert = Attribution & {
  row: number;
  /**
   * Kept when the file names a record we do not hold, which is what makes an old export a restore
   * rather than a second copy of everything in it. Absent when the row was typed into the sheet.
   */
  id?: string;
  transactionDate: string;
  description: string;
  amount: number;
  currency: Currency;
};

export type SheetUpdate = {
  row: number;
  id: string;
  /** Only the fields that differ from what is held, so an untouched file is not a write. */
  changes: Attribution & Stated;
};

export type SheetPlan = {
  inserts: SheetInsert[];
  updates: SheetUpdate[];
  deletions: { row: number; id: string }[];
  refusals: SheetRefusal[];
  /** Rows naming a record we hold and asking for nothing new — what re-importing an export is. */
  unchanged: number;
};

/** As much of a stored transaction as deciding an edit needs. */
export type HeldTransaction = Attribution & {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  currency: Currency;
  /**
   * The original statement row, present exactly when a bank wrote this payment.
   *
   * The rule follows the data rather than a setting: what a bank stated is not editable, and this is
   * how the app knows a bank stated it. A row somebody typed into the sheet has none, and is theirs
   * in full.
   */
  rawData?: unknown;
};

export type NamedRecord = { id: string; name: string };

export type SheetContext = {
  held: readonly HeldTransaction[];
  tags: readonly NamedRecord[];
  goals: readonly NamedRecord[];
  expenses: readonly NamedRecord[];
  /** For a row typed into the sheet with no currency of its own. The export always writes one. */
  defaultCurrency: Currency;
};

/** Amounts are written to the cent, so anything under half a cent is the same figure. */
const SAME_AMOUNT = 0.005;

const indexByName = (records: readonly NamedRecord[]): Map<string, string[]> => {
  const index = new Map<string, string[]>();

  for (const record of records) {
    const key = normaliseCell(record.name);

    index.set(key, [...(index.get(key) ?? []), record.id]);
  }

  return index;
};

/** The field each attribution column fills in, named once so nothing below repeats the pairing. */
const ATTRIBUTION: Record<'category' | 'goal' | 'expense', 'tagId' | 'goalId' | 'expenseId'> = {
  category: 'tagId',
  goal: 'goalId',
  expense: 'expenseId',
};

type FieldOutcome<T> =
  /** The column is not in the file. Whatever is held stays held. */
  | { kind: 'absent' }
  /** The cell is empty and the column is there, which is somebody clearing the field. */
  | { kind: 'cleared' }
  | { kind: 'value'; value: T }
  | { kind: 'refused'; refusal: Omit<SheetRefusal, 'row'> };

const readName = (
  stated: string | undefined,
  field: 'category' | 'goal' | 'expense',
  index: Map<string, string[]>
): FieldOutcome<string> => {
  if (stated === undefined) return { kind: 'absent' };
  if (stated === '') return { kind: 'cleared' };

  const found = index.get(normaliseCell(stated)) ?? [];

  if (!found.length) return { kind: 'refused', refusal: { reason: 'unknown-name', field, value: stated } };
  if (found.length > 1)
    return { kind: 'refused', refusal: { reason: 'ambiguous-name', field, value: stated } };

  return { kind: 'value', value: found[0] };
};

const readBudgetPart = (stated: string | undefined): FieldOutcome<STRATEGY_PART> => {
  if (stated === undefined) return { kind: 'absent' };
  if (stated === '') return { kind: 'cleared' };

  const part = budgetPartFrom(stated);

  return part
    ? { kind: 'value', value: part }
    : {
        kind: 'refused',
        refusal: { reason: 'unknown-budget-part', field: 'budgetPart', value: stated },
      };
};

const CURRENCIES: readonly string[] = ['PLN', 'EUR', 'USD'];

const readStated = (row: SheetRow): Record<keyof Stated, FieldOutcome<unknown>> => {
  const date = row.stated.date;
  const amount = row.stated.amount;
  const currency = row.stated.currency;
  const description = row.stated.description;

  return {
    transactionDate:
      date === undefined
        ? { kind: 'absent' }
        : (() => {
            const iso = parseStatementDate(date, 'YYYY-MM-DD');

            return iso
              ? { kind: 'value' as const, value: iso }
              : { kind: 'refused' as const, refusal: { reason: 'no-date' as const, field: 'date' as const } };
          })(),
    // Emptied rather than filled in is not a way to clear a description on a payment that has one,
    // and it is not an error either: a payment with no description is a real thing.
    description:
      description === undefined ? { kind: 'absent' } : { kind: 'value', value: description },
    amount:
      amount === undefined
        ? { kind: 'absent' }
        : (() => {
            const figure = parseAmount(amount);

            return figure === undefined
              ? {
                  kind: 'refused' as const,
                  refusal: { reason: 'unreadable-amount' as const, field: 'amount' as const },
                }
              : { kind: 'value' as const, value: figure };
          })(),
    // A payment has to be in some currency, so an empty cell leaves the one it is in alone.
    currency:
      currency === undefined || currency === ''
        ? { kind: 'absent' }
        : CURRENCIES.includes(currency.toUpperCase())
          ? { kind: 'value', value: currency.toUpperCase() as Currency }
          : {
              kind: 'refused',
              refusal: { reason: 'unknown-currency', field: 'currency', value: currency },
            },
  };
};

/** Which column a stated field is written in, for naming a refusal by the column somebody edited. */
const STATED_COLUMN: Record<keyof Stated, SheetField> = {
  transactionDate: 'date',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
};

/**
 * Every row that names a record twice, so both can be refused.
 *
 * Not last-one-wins: copying a row is one keystroke in a spreadsheet, and a file that quietly kept
 * whichever copy came second would overwrite somebody's work in the one case they cannot see. Both
 * rows are refused, and the record is left exactly as it was.
 */
const repeatedIds = (rows: readonly SheetRow[]): Set<string> => {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const { id } of rows) {
    if (!id) continue;
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }

  return repeated;
};

/**
 * What this file asks for, decided row by row against what is already held.
 *
 * The rules it is the one implementation of, all of them settled by grilling on 2026-08-19 (#141):
 *
 * - Identity is the `id` column. Known id edits that record, blank id is a new payment, and an id
 *   we do not hold is a new payment *keeping that id*.
 * - Two rows sharing an id is an error rather than a last-one-wins.
 * - Absence never deletes. A mark in the delete column does.
 * - A column missing from the file leaves its field alone; a column present with an empty cell
 *   clears it. Deleting a column and clearing a cell are two different gestures.
 * - What a bank said is not editable. What somebody typed into the sheet is theirs in full.
 * - Names are matched, never created: an unknown or ambiguous one is reported, that field left as
 *   it was, and the rest of the row still applied.
 */
export const planSheet = (rows: readonly SheetRow[], context: SheetContext): SheetPlan => {
  const held = new Map(context.held.map((transaction) => [transaction.id, transaction]));
  const names = {
    category: indexByName(context.tags),
    goal: indexByName(context.goals),
    expense: indexByName(context.expenses),
  };
  const repeated = repeatedIds(rows);

  const plan: SheetPlan = { inserts: [], updates: [], deletions: [], refusals: [], unchanged: 0 };

  for (const row of rows) {
    if (row.id && repeated.has(row.id)) {
      plan.refusals.push({ row: row.row, reason: 'duplicate-id' });
      continue;
    }

    const stored = row.id ? held.get(row.id) : undefined;

    if (row.deleted) {
      if (stored) plan.deletions.push({ row: row.row, id: stored.id });
      else plan.refusals.push({ row: row.row, reason: 'nothing-to-delete' });
      continue;
    }

    const attribution: Attribution = {};
    let touched = false;

    for (const column of ['category', 'goal', 'expense'] as const) {
      const outcome = readName(row.stated[column], column, names[column]);
      const field = ATTRIBUTION[column];

      if (outcome.kind === 'refused') {
        plan.refusals.push({ row: row.row, ...outcome.refusal });
        continue;
      }
      if (outcome.kind === 'absent') continue;

      const value = outcome.kind === 'cleared' ? undefined : outcome.value;

      if (stored && stored[field] === value) continue;
      if (!stored && value === undefined) continue;

      attribution[field] = value;
      touched = true;
    }

    const part = readBudgetPart(row.stated.budgetPart);

    if (part.kind === 'refused') plan.refusals.push({ row: row.row, ...part.refusal });
    else if (part.kind !== 'absent') {
      const value = part.kind === 'cleared' ? undefined : part.value;

      if (!(stored ? stored.strategyPart === value : value === undefined)) {
        attribution.strategyPart = value;
        touched = true;
      }
    }

    const statedOutcomes = readStated(row);

    for (const outcome of Object.values(statedOutcomes)) {
      if (outcome.kind === 'refused') plan.refusals.push({ row: row.row, ...outcome.refusal });
    }

    const value = <T>(outcome: FieldOutcome<unknown>): T | undefined =>
      outcome.kind === 'value' ? (outcome.value as T) : undefined;

    const transactionDate = value<string>(statedOutcomes.transactionDate);
    const amount = value<number>(statedOutcomes.amount);
    const description = value<string>(statedOutcomes.description);
    const currency = value<Currency>(statedOutcomes.currency);

    if (!stored) {
      // A payment with no day and no figure is not a payment, and there is nothing held here to
      // fall back on: the row is already reported above by whichever of the two could not be read.
      if (transactionDate === undefined || amount === undefined) continue;

      // Nor is a figure in a currency we do not know. On an *edit* an unknown currency costs only
      // that field, because the payment keeps the currency it already had — but a new row has none
      // to keep, and filing it under the app's default would store a figure that means something
      // else. `defaultCurrency` is for a row that states no currency at all, not for a wrong one.
      if (statedOutcomes.currency.kind === 'refused') continue;

      plan.inserts.push({
        row: row.row,
        id: row.id,
        transactionDate,
        description: description ?? '',
        amount,
        currency: currency ?? context.defaultCurrency,
        ...attribution,
      });
      continue;
    }

    const fromBank = stored.rawData !== undefined;
    const changes: SheetUpdate['changes'] = { ...attribution };

    const changed: Stated = {};

    if (transactionDate !== undefined && transactionDate !== stored.transactionDate)
      changed.transactionDate = transactionDate;
    if (description !== undefined && description !== stored.description)
      changed.description = description;
    if (amount !== undefined && Math.abs(amount - stored.amount) > SAME_AMOUNT)
      changed.amount = amount;
    if (currency !== undefined && currency !== stored.currency) changed.currency = currency;

    const edited = Object.keys(changed) as (keyof Stated)[];

    if (fromBank) {
      // Named column by column rather than once for the row: somebody who edited the amount and the
      // date wants to be told both were refused, and a single line would have them fix one and
      // re-upload to find out about the other.
      for (const field of edited)
        plan.refusals.push({ row: row.row, reason: 'bank-fact-edited', field: STATED_COLUMN[field] });
    } else if (edited.length) {
      Object.assign(changes, changed);
      touched = true;
    }

    if (touched) plan.updates.push({ row: row.row, id: stored.id, changes });
    else plan.unchanged += 1;
  }

  return plan;
};
