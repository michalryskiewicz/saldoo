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

type DutyTransactionCandidate = { id: string; transactionDate?: string };

type DutyToSettle = {
  id: string;
  executionDate: Date;
  ignored?: boolean;
  transactionId?: string | null;
  rejectedTransactionIds?: string[];
};

type AllocateTransactionsToDuties = {
  duties: DutyToSettle[];
  transactions: DutyTransactionCandidate[];
};

export type DutySettlement = { dutyId: string; transactionId: string };

type PairingCandidate = DutySettlement & {
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
    a.dutyId.localeCompare(b.dutyId) ||
    a.transactionId.localeCompare(b.transactionId)
  );
}

/**
 * Which payment settles which occurrence — one payment to at most one occurrence.
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
export function allocateTransactionsToDuties({
  duties,
  transactions,
}: AllocateTransactionsToDuties): DutySettlement[] {
  const settledDuties = new Set<string>();
  const spentTransactions = new Set<string>();
  const allocation: DutySettlement[] = [];

  for (const duty of duties) {
    if (!duty.transactionId) continue;

    settledDuties.add(duty.id);
    spentTransactions.add(duty.transactionId);
    allocation.push({ dutyId: duty.id, transactionId: duty.transactionId });
  }

  const candidates: PairingCandidate[] = [];

  for (const duty of duties) {
    if (settledDuties.has(duty.id) || duty.ignored) continue;

    const rejected = new Set(duty.rejectedTransactionIds ?? []);

    for (const transaction of transactions) {
      if (!transaction.transactionDate || rejected.has(transaction.id)) continue;

      const paidOn = new Date(transaction.transactionDate);
      const distanceInDays = Math.round(
        Math.abs(paidOn.getTime() - duty.executionDate.getTime()) / DAY_IN_MS
      );

      if (distanceInDays > MATCH_WINDOW_DAYS) continue;

      candidates.push({
        dutyId: duty.id,
        transactionId: transaction.id,
        distanceInDays,
        dueOn: duty.executionDate.getTime(),
        paidOn: paidOn.getTime(),
      });
    }
  }

  candidates.sort(closestPairingFirst);

  for (const { dutyId, transactionId } of candidates) {
    if (settledDuties.has(dutyId) || spentTransactions.has(transactionId)) continue;

    settledDuties.add(dutyId);
    spentTransactions.add(transactionId);
    allocation.push({ dutyId, transactionId });
  }

  return allocation;
}
