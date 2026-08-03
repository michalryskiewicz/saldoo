import type { DBExpense } from '@/database/expenses.ts';
import { SEVERITY } from '@/constant.ts';

/**
 * Whether a cost would still be there once the income stops.
 *
 * This is the one question the emergency fund asks. A fund sized on everything a person spends
 * answers a different question — what their life costs — and that figure is already on the
 * chart; multiplying it by three is arithmetic anyone can do in their head.
 *
 * Costs entered before the question was asked answer it from the priority they carry. `LOW` is the
 * only value a person had to choose deliberately — `MEDIUM` is the form's default — so it is the
 * only one that changes anything, and every emergency fund on any device reads exactly as it did
 * before this existed.
 *
 * That the priority is still an editable field does not make this two meanings in one place: the
 * form asks both questions and writes both answers, so a cost whose priority somebody changed has
 * an explicit answer here by the time the save lands. The fallback only ever speaks for a cost
 * nobody has opened since.
 */
export const survivesIncomeLoss = (expense: DBExpense): boolean =>
  expense.survivesIncomeLoss ?? expense.severity !== SEVERITY.LOW;
