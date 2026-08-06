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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type TransactionCandidate = { id: string; transactionDate?: string };

type OccurrenceToSettle = {
  id: string;
  executionDate: Date;
  ignored?: boolean;
  transactionId?: string | null;
  rejectedTransactionIds?: string[];
};

type AllocateTransactionsToOccurrences = {
  /**
   * Everything owed or promised on a day, of whichever kind: a cost falling due, or a contribution
   * declared towards a goal. One rule for one-to-one rather than two implementations of it.
   *
   * Callers pass one attribution's worth at a time, which is safe because a payment carries one:
   * a transfer filed against a goal is not also filed against a cost. If that ever stops being
   * true, these have to be allocated in a single call or one payment will settle one of each.
   */
  occurrences: OccurrenceToSettle[];
  transactions: TransactionCandidate[];
};

export type Settlement = { occurrenceId: string; transactionId: string };

type PairingCandidate = Settlement & {
  distanceInDays: number;
  dueOn: number;
  paidOn: number;
};

/**
 * Ranks pairings so two devices reach the same allocation from the same data.
 *
 * Distance decides; the rest breaks ties without ever consulting the order the rows
 * happened to arrive in. The oldest debt is settled first, by the earliest payment.
 */
function closestPairingFirst(a: PairingCandidate, b: PairingCandidate): number {
  return (
    a.distanceInDays - b.distanceInDays ||
    a.dueOn - b.dueOn ||
    a.paidOn - b.paidOn ||
    a.occurrenceId.localeCompare(b.occurrenceId) ||
    a.transactionId.localeCompare(b.transactionId)
  );
}

/**
 * Which payment settles which occurrence — one payment to at most one occurrence.
 *
 * "Occurrence" covers both a cost falling due and a contribution declared towards a goal. One
 * implementation of the one-to-one rule rather than two, because the second copy is where the two
 * screens would drift apart.
 *
 * A date window cannot answer this one occurrence at a time: a daily expense has nine
 * occurrences inside one payment's window, and answering for each in turn marks all nine
 * paid off a single transfer. The answer belongs to the whole set — the closest pairing
 * wins and takes both sides out of the running.
 *
 * A pairing the person has already accepted is kept and its payment spent, so re-running
 * this never reshuffles what is on record. A payment they unlinked is passed over rather
 * than disqualifying that occurrence outright: the next payment in the same window may
 * well be the right one, and an occurrence that could never match again would punish them
 * for correcting the guess. An occurrence marked as one that will not happen takes no
 * payment at all, leaving it for the occurrence that will.
 *
 * Amount plays no part yet — matching is dates only, which is why unlinking exists.
 */
export function allocateTransactionsToOccurrences({
  occurrences,
  transactions,
}: AllocateTransactionsToOccurrences): Settlement[] {
  const settled = new Set<string>();
  const spentTransactions = new Set<string>();
  const allocation: Settlement[] = [];

  for (const occurrence of occurrences) {
    if (!occurrence.transactionId) continue;

    settled.add(occurrence.id);
    spentTransactions.add(occurrence.transactionId);
    allocation.push({ occurrenceId: occurrence.id, transactionId: occurrence.transactionId });
  }

  const candidates: PairingCandidate[] = [];

  for (const occurrence of occurrences) {
    if (settled.has(occurrence.id) || occurrence.ignored) continue;

    const rejected = new Set(occurrence.rejectedTransactionIds ?? []);

    for (const transaction of transactions) {
      if (!transaction.transactionDate || rejected.has(transaction.id)) continue;

      const paidOn = new Date(transaction.transactionDate);
      const distanceInDays = Math.round(
        Math.abs(paidOn.getTime() - occurrence.executionDate.getTime()) / DAY_IN_MS
      );

      if (distanceInDays > MATCH_WINDOW_DAYS) continue;

      candidates.push({
        occurrenceId: occurrence.id,
        transactionId: transaction.id,
        distanceInDays,
        dueOn: occurrence.executionDate.getTime(),
        paidOn: paidOn.getTime(),
      });
    }
  }

  candidates.sort(closestPairingFirst);

  for (const { occurrenceId, transactionId } of candidates) {
    if (settled.has(occurrenceId) || spentTransactions.has(transactionId)) continue;

    settled.add(occurrenceId);
    spentTransactions.add(transactionId);
    allocation.push({ occurrenceId, transactionId });
  }

  return allocation;
}
