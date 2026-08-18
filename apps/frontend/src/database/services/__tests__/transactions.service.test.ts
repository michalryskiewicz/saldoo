import { describe, it, expect } from 'vitest';
import { toDBTransaction, allocateTransactionsToOccurrences } from '../transactions.service';
import type { ParsedTransaction } from '@/lib/banks/contract.ts';

const payment = (overrides: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  transactionDate: '2025-12-09',
  description: 'Test Tytuł',
  amount: -123.45,
  currency: 'PLN',
  transactionId: 'TRX123456',
  rawData: ['2025-12-09', '2025-12-09', '', 'Test Tytuł', '', '', '', 'TRX123456', '-123,45', 'PLN'],
  ...overrides,
});

describe('toDBTransaction', () => {
  it('keeps what the parser read and adds only what the database owns', async () => {
    const parsed = payment();

    const stored = await toDBTransaction(parsed, 'ING');

    expect(stored.sourceBank).toBe('ING');
    expect(stored.amount).toBe(-123.45);
    expect(stored.currency).toBe('PLN');
    expect(stored.transactionDate).toBe('2025-12-09');
    expect(stored.description).toBe('Test Tytuł');
    expect(stored.transactionId).toBe('TRX123456');
    expect(stored.rawData).toEqual(parsed.rawData);
    expect(stored.id).toBeDefined();
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(stored.hash).toBeDefined();
  });

  it('files a payment under whichever bank read it', async () => {
    const stored = await toDBTransaction(payment({ transactionId: undefined }), 'PKOBP');

    expect(stored.sourceBank).toBe('PKOBP');
    expect(stored.transactionId).toBeUndefined();
  });

  describe('hash', () => {
    it('differs when the rows differ', async () => {
      const one = await toDBTransaction(payment({ rawData: ['a', 'TRX1'] }), 'ING');
      const other = await toDBTransaction(payment({ rawData: ['a', 'TRX2'] }), 'ING');

      expect(one.hash).not.toBe(other.hash);
    });

    it('is the same for the same row, which is what makes re-uploading a statement harmless', async () => {
      const row = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX', '-100,00', 'PLN'];

      const one = await toDBTransaction(payment({ rawData: row }), 'ING');
      const other = await toDBTransaction(payment({ rawData: row }), 'ING');

      expect(one.hash).toBe(other.hash);
    });

    it('is taken over the original row, not the parsed fields', async () => {
      const row = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX', '-100,00', 'PLN'];

      // Two readings of one row that disagree about everything except the row itself: a parser fix
      // must not make already-imported payments look new.
      const before = await toDBTransaction(payment({ rawData: row, description: 'old reading' }), 'ING');
      const after = await toDBTransaction(
        payment({ rawData: row, description: 'better reading', amount: -100 }),
        'ING'
      );

      expect(before.hash).toBe(after.hash);
    });
  });
});

describe('allocateTransactionsToOccurrences', () => {
  it('lets one payment settle one occurrence, not every occurrence it falls near', () => {
    const allocation = allocateTransactionsToOccurrences({
      occurrences: [
        { id: 'duty-13th', executionDate: new Date(2026, 6, 13) },
        { id: 'duty-14th', executionDate: new Date(2026, 6, 14) },
        { id: 'duty-15th', executionDate: new Date(2026, 6, 15) },
      ],
      transactions: [{ id: 'the-only-payment', transactionDate: '2026-07-14' }],
    });

    expect(allocation).toEqual([{ occurrenceId: 'duty-14th', transactionId: 'the-only-payment' }]);
  });

  it('passes over a payment this occurrence was unlinked from, however close it lands', () => {
    const allocation = allocateTransactionsToOccurrences({
      occurrences: [
        {
          id: 'duty-15th',
          executionDate: new Date(2026, 6, 15),
          rejectedTransactionIds: ['the-wrong-one'],
        },
      ],
      transactions: [
        { id: 'the-wrong-one', transactionDate: '2026-07-15' },
        { id: 'the-right-one', transactionDate: '2026-07-17' },
      ],
    });

    expect(allocation).toEqual([{ occurrenceId: 'duty-15th', transactionId: 'the-right-one' }]);
  });

  it('leaves a payment already settled where it is, even when it sits closer to another occurrence', () => {
    const allocation = allocateTransactionsToOccurrences({
      occurrences: [
        {
          id: 'duty-15th',
          executionDate: new Date(2026, 6, 15),
          transactionId: 'the-payment-on-record',
        },
        { id: 'duty-16th', executionDate: new Date(2026, 6, 16) },
      ],
      transactions: [{ id: 'the-payment-on-record', transactionDate: '2026-07-16' }],
    });

    expect(allocation).toEqual([
      { occurrenceId: 'duty-15th', transactionId: 'the-payment-on-record' },
    ]);
  });

  it('settles the older debt when a payment falls exactly between two occurrences', () => {
    const before = { id: 'z-duty-14th', executionDate: new Date(2026, 6, 14) };
    const after = { id: 'a-duty-16th', executionDate: new Date(2026, 6, 16) };
    const transactions = [{ id: 'the-only-payment', transactionDate: '2026-07-15' }];

    const asListed = allocateTransactionsToOccurrences({ occurrences: [before, after], transactions });
    const reversed = allocateTransactionsToOccurrences({ occurrences: [after, before], transactions });

    expect(asListed).toEqual([{ occurrenceId: 'z-duty-14th', transactionId: 'the-only-payment' }]);
    expect(reversed).toEqual(asListed);
  });

  it('settles with the earlier payment when two land equally close', () => {
    const earlier = { id: 'the-earlier-payment', transactionDate: '2026-07-14' };
    const later = { id: 'the-later-payment', transactionDate: '2026-07-16' };
    const duties = [{ id: 'duty-15th', executionDate: new Date(2026, 6, 15) }];

    const asListed = allocateTransactionsToOccurrences({ occurrences: duties, transactions: [earlier, later] });
    const reversed = allocateTransactionsToOccurrences({ occurrences: duties, transactions: [later, earlier] });

    expect(asListed).toEqual([{ occurrenceId: 'duty-15th', transactionId: 'the-earlier-payment' }]);
    expect(reversed).toEqual(asListed);
  });

  it('lets a payment reach a real occurrence past one the person said would not happen', () => {
    const allocation = allocateTransactionsToOccurrences({
      occurrences: [
        { id: 'duty-skipped', executionDate: new Date(2026, 6, 14), ignored: true },
        { id: 'duty-15th', executionDate: new Date(2026, 6, 15) },
      ],
      transactions: [{ id: 'the-only-payment', transactionDate: '2026-07-14' }],
    });

    expect(allocation).toEqual([{ occurrenceId: 'duty-15th', transactionId: 'the-only-payment' }]);
  });
});
