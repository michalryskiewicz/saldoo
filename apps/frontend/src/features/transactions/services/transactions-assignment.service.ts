import i18n, { type TranslationKey } from '@/i18n.ts';
import type { DBTransaction } from '@/database/transactions.ts';

export type AssignableTransaction = Pick<DBTransaction, 'strategyPart'> & {
  tag?: { name?: string };
  expense?: { description?: string };
};

/** One filing: what it answers, and the answer. */
export type TransactionAssignment = { label: string; value: string };

/**
 * Where a payment has been filed, as one list rather than three columns.
 *
 * Three columns for this — category, budget part, planned expense — left a freshly imported
 * statement with two-fifths of its width blank, since a payment arrives filed under none of
 * them. Together they are one thought ("what this was"), and read as one they take one column
 * and grow into it as the filing is done.
 *
 * The label rides along because three outline badges look alike, and "JEDZENIE" beside
 * "Potrzeby" beside "Zakupy spożywcze" does not say which is which on its own.
 */
export const transactionAssignments = (row: AssignableTransaction): TransactionAssignment[] =>
  [
    { label: i18n.t('forms.category'), value: row.tag?.name },
    {
      label: i18n.t('forms.strategy-part'),
      value: row.strategyPart ? i18n.t(row.strategyPart as TranslationKey) : undefined,
    },
    { label: i18n.t('settled_expense'), value: row.expense?.description },
  ].filter((assignment): assignment is TransactionAssignment => !!assignment.value);
