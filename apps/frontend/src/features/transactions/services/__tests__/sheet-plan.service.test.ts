import { describe, expect, it } from 'vitest';
import { STRATEGY_PART } from '@/constant.ts';
import type { SheetRow } from '@/lib/saldoo-sheet/read.ts';
import {
  planSheet,
  type HeldTransaction,
  type SheetContext,
} from '@/features/transactions/services/sheet-plan.service.ts';

/**
 * Every rule of the round trip, as a value rather than a screen.
 *
 * The decisions under test were settled by grilling (#141) and each one is load-bearing: they are
 * the difference between a spreadsheet that bulk-edits somebody's year and one that quietly
 * overwrites it. The failure modes they exist for are all silent, which is why they are unit tests
 * rather than something anybody would notice while clicking.
 */

const HELD: HeldTransaction = {
  id: 'held-1',
  transactionDate: '2026-07-02',
  description: 'BIEDRONKA 1234',
  amount: -213.47,
  currency: 'PLN',
  // What a bank stated. Its presence is the whole of the editability rule — see decision 7.
  rawData: ['2026-07-02', 'BIEDRONKA 1234', '-213,47'],
};

const TYPED: HeldTransaction = {
  id: 'typed-1',
  transactionDate: '2026-07-05',
  description: 'Kawa',
  amount: -12,
  currency: 'PLN',
};

const context = (over: Partial<SheetContext> = {}): SheetContext => ({
  held: [HELD, TYPED],
  tags: [{ id: 'tag-food', name: 'Jedzenie' }],
  goals: [{ id: 'goal-ike', name: 'IKE' }],
  expenses: [{ id: 'exp-rent', name: 'Czynsz' }],
  defaultCurrency: 'PLN',
  ...over,
});

const row = (over: Partial<SheetRow> = {}): SheetRow => ({
  row: 1,
  deleted: false,
  stated: {},
  ...over,
});

describe('which record a row is', () => {
  it('edits the record a known id names', () => {
    const plan = planSheet([row({ id: 'held-1', stated: { category: 'Jedzenie' } })], context());

    expect(plan.updates).toEqual([{ row: 1, id: 'held-1', changes: { tagId: 'tag-food' } }]);
    expect(plan.inserts).toEqual([]);
  });

  it('makes a new payment of a row with a blank id, so somebody can type one in Excel', () => {
    const plan = planSheet(
      [row({ stated: { date: '2026-08-01', description: 'Kwiaty', amount: '-49,99' } })],
      context()
    );

    expect(plan.inserts).toMatchObject([
      { row: 1, id: undefined, transactionDate: '2026-08-01', description: 'Kwiaty', amount: -49.99 },
    ]);
  });

  it('keeps an id it does not hold, so an old export is a restore rather than a second copy', () => {
    const plan = planSheet(
      [row({ id: 'gone-1', stated: { date: '2026-08-01', description: 'x', amount: '1' } })],
      context()
    );

    expect(plan.inserts[0].id).toBe('gone-1');
  });

  it('refuses both rows when two of them name the same record', () => {
    // Copying a row is one keystroke in a spreadsheet. Last-one-wins would overwrite somebody's
    // work in the one case they cannot see.
    const plan = planSheet(
      [
        row({ row: 1, id: 'held-1', stated: { category: 'Jedzenie' } }),
        row({ row: 2, id: 'held-1', stated: { category: '' } }),
      ],
      context()
    );

    expect(plan.updates).toEqual([]);
    expect(plan.refusals).toEqual([
      { row: 1, reason: 'duplicate-id' },
      { row: 2, reason: 'duplicate-id' },
    ]);
  });

  it('counts a row that asks for nothing as already held', () => {
    // What re-importing an untouched export is, and it must read as normal rather than as a problem.
    const plan = planSheet(
      [
        row({
          id: 'held-1',
          stated: {
            date: '2026-07-02',
            description: 'BIEDRONKA 1234',
            amount: '-213,47',
            currency: 'PLN',
            category: '',
            goal: '',
            expense: '',
            budgetPart: '',
          },
        }),
      ],
      context()
    );

    expect(plan).toMatchObject({ unchanged: 1, updates: [], inserts: [], refusals: [] });
  });
});

describe('what a name resolves to', () => {
  it('matches a category, goal and cost by name', () => {
    const plan = planSheet(
      [row({ id: 'held-1', stated: { category: 'Jedzenie', goal: 'IKE', expense: 'Czynsz' } })],
      context()
    );

    expect(plan.updates[0].changes).toEqual({
      tagId: 'tag-food',
      goalId: 'goal-ike',
      expenseId: 'exp-rent',
    });
  });

  it('does not mind case or missing diacritics', () => {
    const plan = planSheet([row({ id: 'held-1', stated: { category: 'jedzenie' } })], context());

    expect(plan.updates[0].changes.tagId).toBe('tag-food');
  });

  it('reports a name nothing is called, leaves that field alone, and imports the rest of the row', () => {
    // Decision 6: a typo must not create a category nobody notices.
    const plan = planSheet(
      [row({ id: 'held-1', stated: { category: 'Jedzeni', expense: 'Czynsz' } })],
      context()
    );

    expect(plan.refusals).toEqual([
      { row: 1, reason: 'unknown-name', field: 'category', value: 'Jedzeni' },
    ]);
    expect(plan.updates[0].changes).toEqual({ expenseId: 'exp-rent' });
  });

  it('refuses to guess between two things sharing a name', () => {
    // `goals` and `expenses` are indexed by description without uniqueness, so this is a real state.
    const plan = planSheet(
      [row({ id: 'held-1', stated: { goal: 'Wakacje' } })],
      context({
        goals: [
          { id: 'goal-a', name: 'Wakacje' },
          { id: 'goal-b', name: 'Wakacje' },
        ],
      })
    );

    expect(plan.refusals).toEqual([
      { row: 1, reason: 'ambiguous-name', field: 'goal', value: 'Wakacje' },
    ]);
    expect(plan.updates).toEqual([]);
  });

  it('reads the part of the budget by its label and reports a cell no strategy has a part for', () => {
    expect(
      planSheet([row({ id: 'held-1', stated: { budgetPart: 'Potrzeby' } })], context()).updates[0]
        .changes
    ).toEqual({ strategyPart: STRATEGY_PART.NEEDS });

    expect(
      planSheet([row({ id: 'held-1', stated: { budgetPart: 'Rozrywka' } })], context()).refusals
    ).toEqual([{ row: 1, reason: 'unknown-budget-part', field: 'budgetPart', value: 'Rozrywka' }]);
  });
});

describe('a column that is gone against a cell that is empty', () => {
  it('leaves a field alone when the file has no column for it', () => {
    const plan = planSheet(
      [row({ id: 'typed-1', stated: { description: 'Kawa' } })],
      context({ held: [{ ...TYPED, tagId: 'tag-food' }] })
    );

    expect(plan).toMatchObject({ updates: [], unchanged: 1 });
  });

  it('clears the field when the column is there and the cell is empty', () => {
    const plan = planSheet(
      [row({ id: 'typed-1', stated: { category: '' } })],
      context({ held: [{ ...TYPED, tagId: 'tag-food' }] })
    );

    expect(plan.updates).toEqual([{ row: 1, id: 'typed-1', changes: { tagId: undefined } }]);
  });
});

describe('what a bank stated', () => {
  it('refuses an edit to the date, description, amount or currency of an imported payment', () => {
    const plan = planSheet(
      [
        row({
          id: 'held-1',
          stated: { date: '2026-07-03', description: 'Zmienione', amount: '-999', currency: 'EUR' },
        }),
      ],
      context()
    );

    expect(plan.updates).toEqual([]);
    expect(plan.refusals.map((refusal) => refusal.field)).toEqual([
      'date',
      'description',
      'amount',
      'currency',
    ]);
    expect(plan.refusals.every((refusal) => refusal.reason === 'bank-fact-edited')).toBe(true);
  });

  it('still applies the attribution on that row, which is the half that is theirs', () => {
    const plan = planSheet(
      [row({ id: 'held-1', stated: { amount: '-999', category: 'Jedzenie' } })],
      context()
    );

    expect(plan.updates).toEqual([{ row: 1, id: 'held-1', changes: { tagId: 'tag-food' } }]);
    expect(plan.refusals).toHaveLength(1);
  });

  it('lets a row nobody’s bank wrote be changed in full', () => {
    // The rule follows the data rather than a setting: no `rawData`, no bank, no restriction.
    const plan = planSheet(
      [row({ id: 'typed-1', stated: { date: '2026-07-06', description: 'Herbata', amount: '-15' } })],
      context()
    );

    expect(plan.updates).toEqual([
      {
        row: 1,
        id: 'typed-1',
        changes: { transactionDate: '2026-07-06', description: 'Herbata', amount: -15 },
      },
    ]);
  });
});

describe('deleting', () => {
  it('removes the record a marked row names', () => {
    const plan = planSheet([row({ id: 'held-1', deleted: true })], context());

    expect(plan.deletions).toEqual([{ row: 1, id: 'held-1' }]);
  });

  it('says so when a marked row names nothing we hold, rather than creating and removing it', () => {
    const plan = planSheet([row({ id: 'gone', deleted: true }), row({ row: 2, deleted: true })], context());

    expect(plan.deletions).toEqual([]);
    expect(plan.refusals).toEqual([
      { row: 1, reason: 'nothing-to-delete' },
      { row: 2, reason: 'nothing-to-delete' },
    ]);
  });

  it('takes nothing away for the rows a file simply does not mention', () => {
    // Decision 5. Somebody exports March and re-imports it; deletion by omission would take the
    // other eleven months with it.
    const plan = planSheet([row({ id: 'held-1', stated: { category: 'Jedzenie' } })], context());

    expect(plan.deletions).toEqual([]);
  });
});

describe('what a row has to say to become a payment', () => {
  it('reports a date it cannot read and stores nothing from that row', () => {
    const plan = planSheet(
      [row({ stated: { date: '31.02.2026', description: 'x', amount: '1' } })],
      context()
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.refusals).toEqual([{ row: 1, reason: 'no-date', field: 'date' }]);
  });

  it('reports an amount it cannot read', () => {
    const plan = planSheet(
      [row({ stated: { date: '2026-08-01', description: 'x', amount: 'brak danych' } })],
      context()
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.refusals).toEqual([{ row: 1, reason: 'unreadable-amount', field: 'amount' }]);
  });

  it('reads a Polish figure with a space for thousands, which is how a bank writes it', () => {
    const plan = planSheet(
      [row({ stated: { date: '2026-08-01', description: 'x', amount: '-1 234,56' } })],
      context()
    );

    expect(plan.inserts[0].amount).toBe(-1234.56);
  });

  it('falls back to the currency the app is set to, for a row typed with no currency of its own', () => {
    const plan = planSheet(
      [row({ stated: { date: '2026-08-01', description: 'x', amount: '1' } })],
      context({ defaultCurrency: 'EUR' })
    );

    expect(plan.inserts[0].currency).toBe('EUR');
  });

  it('refuses a new row in a currency it does not know rather than filing it under another', () => {
    // The fallback is for a row that states no currency, never for one that states a wrong one:
    // an amount put under the wrong currency is a figure that means something else.
    const plan = planSheet(
      [row({ stated: { date: '2026-08-01', description: 'x', amount: '1', currency: 'GBP' } })],
      context()
    );

    expect(plan.refusals).toEqual([
      { row: 1, reason: 'unknown-currency', field: 'currency', value: 'GBP' },
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it('costs an existing payment only that field, because it keeps the currency it had', () => {
    const plan = planSheet(
      [row({ id: 'typed-1', stated: { currency: 'GBP', description: 'Kawa mrożona' } })],
      context()
    );

    expect(plan.updates).toEqual([
      { row: 1, id: 'typed-1', changes: { description: 'Kawa mrożona' } },
    ]);
    expect(plan.refusals).toHaveLength(1);
  });
});
