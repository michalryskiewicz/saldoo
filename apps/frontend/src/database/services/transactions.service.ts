import { type DBTransaction } from '../transactions';
import { v4 as uuidv4 } from 'uuid';
import { hashString } from '@/lib/helpers.ts';
import type { Currency } from '@/constant.ts';

// Map ING row to DBTransaction
export async function mapINGRowToDBTransaction(row: unknown[]): Promise<DBTransaction> {
  // Adjust indices as per ING_HEADER_ROW
  return {
    id: uuidv4(),
    createdAt: new Date(),
    sourceBank: 'ING',
    amount: parseFloat((row[8] as string)?.replace(',', '.') || '0'),
    currency: (row[9] as Currency) || '',
    transactionDate: (row[0] as string) || '',
    description: (row[3] as string) || '',
    hash: await hashString(row.join('|')), // You may want to implement a hash function
    transactionId: (row[7] as string) || '',
    rawData: row,
  };
}

// Map PKOBP row to DBTransaction
export async function mapPKOBPRowToDBTransaction(row: unknown[]): Promise<DBTransaction> {
  // Adjust indices as per PKOBP_HEADER_ROW
  return {
    id: uuidv4(),
    createdAt: new Date(),
    sourceBank: 'PKOBP',
    amount: parseFloat((row[3] as string)?.replace(',', '.') || '0'),
    currency: (row[4] as Currency) || '',
    transactionDate: (row[0] as string) || '',
    description: (row.slice(5).join(' ') || '')?.trim(),
    hash: await hashString(row.join('|')), // You may want to implement a hash function
    rawData: row,
  };
}

// Generic dispatcher
export async function mapBankRowToDBTransaction(
  bank: string,
  row: unknown[]
): Promise<DBTransaction> {
  switch (bank) {
    case 'ING':
      return mapINGRowToDBTransaction(row);
    case 'PKOBP':
      return mapPKOBPRowToDBTransaction(row);
    default:
      throw new Error(`Unsupported bank: ${bank}`);
  }
}

/** How far either side of a duty's execution date a payment still counts as that duty's. */
const MATCH_WINDOW_DAYS = 4;

type DutyTransactionCandidate = { id: string; transactionDate?: string };

type SelectTransactionForDuty = {
  executionDate: Date;
  rejectedTransactionIds?: string[];
  transactions: DutyTransactionCandidate[];
};

/**
 * The payment that settles a duty, if one of these is.
 *
 * Matching is a date window rather than an amount, so it can land on the wrong payment —
 * which is why unlinking one has to be possible at all. A transaction the user has
 * unlinked from this duty is passed over rather than disqualifying the duty outright: the
 * next payment in the same window may well be the right one, and a duty that could never
 * be matched again would punish the person for correcting the guess.
 */
export function selectTransactionForDuty({
  executionDate,
  rejectedTransactionIds,
  transactions,
}: SelectTransactionForDuty): DutyTransactionCandidate | undefined {
  const rejected = new Set(rejectedTransactionIds ?? []);

  const earliest = new Date(executionDate);
  earliest.setDate(executionDate.getDate() - MATCH_WINDOW_DAYS);
  const latest = new Date(executionDate);
  latest.setDate(executionDate.getDate() + MATCH_WINDOW_DAYS);

  return transactions.find((transaction) => {
    if (!transaction.transactionDate || rejected.has(transaction.id)) return false;

    const paidOn = new Date(transaction.transactionDate);

    return paidOn >= earliest && paidOn <= latest;
  });
}
