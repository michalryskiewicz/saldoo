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
