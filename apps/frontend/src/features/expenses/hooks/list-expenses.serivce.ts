import type { DBExpense } from '@/database/expenses';
import type { DBTag } from '@/database/tags.ts';

export const combineExpensesWithTags = (
  expenses: DBExpense[],
  tags: DBTag[] | undefined
): (DBExpense & { tag?: DBTag })[] => {
  if (!tags?.length) {
    return expenses;
  }

  return expenses.map((expense) => {
    const tag = tags.find((t) => t.id === expense.tagId);
    return { ...expense, tag };
  });
};
