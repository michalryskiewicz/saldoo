import { describe, it, expect } from 'vitest';
import {
  mapINGRowToDBTransaction,
  mapPKOBPRowToDBTransaction,
  mapBankRowToDBTransaction,
  allocateTransactionsToDuties,
} from '../transactions.service';

describe('transactions.service', () => {
  describe('mapINGRowToDBTransaction', () => {
    it('maps ING CSV row to DBTransaction correctly', async () => {
      const mockRow = [
        '2025-12-09', // Data transakcji
        '2025-12-09', // Data księgowania
        'Test Kontrahent', // Dane kontrahenta
        'Test Tytuł', // Tytuł
        '12345678901234567890', // Nr rachunku
        'ING Bank', // Nazwa banku
        'Szczegóły', // Szczegóły
        'TRX123456', // Nr transakcji
        '-123,45', // Kwota transakcji
        'PLN', // Waluta
      ];

      const result = await mapINGRowToDBTransaction(mockRow);

      expect(result.sourceBank).toBe('ING');
      expect(result.amount).toBe(-123.45);
      expect(result.currency).toBe('PLN');
      expect(result.transactionDate).toBe('2025-12-09');
      expect(result.description).toBe('Test Tytuł');
      expect(result.transactionId).toBe('TRX123456');
      expect(result.rawData).toEqual(mockRow);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.hash).toBeDefined();
    });

    it('handles positive amounts', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', '', '', '', '', '', '', '1000,50', 'PLN'];
      const result = await mapINGRowToDBTransaction(mockRow);
      expect(result.amount).toBe(1000.5);
    });

    it('handles zero amount', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', '', '', '', '', '', '', '0,00', 'PLN'];
      const result = await mapINGRowToDBTransaction(mockRow);
      expect(result.amount).toBe(0);
    });

    it('handles empty amount', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', '', '', '', '', '', '', '', 'PLN'];
      const result = await mapINGRowToDBTransaction(mockRow);
      expect(result.amount).toBe(0);
    });

    it('handles EUR currency', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', '', '', '', '', '', '', '-50,25', 'EUR'];
      const result = await mapINGRowToDBTransaction(mockRow);
      expect(result.currency).toBe('EUR');
      expect(result.amount).toBe(-50.25);
    });
  });

  describe('mapPKOBPRowToDBTransaction', () => {
    it('maps PKOBP CSV row to DBTransaction correctly', async () => {
      const mockRow = [
        '2025-12-09', // Data operacji
        '2025-12-09', // Data waluty
        'Przelew', // Typ transakcji
        '-250,00', // Kwota
        'PLN', // Waluta
        'Opis', // Opis transakcji
        'część 1',
        'część 2',
      ];

      const result = await mapPKOBPRowToDBTransaction(mockRow);

      expect(result.sourceBank).toBe('PKOBP');
      expect(result.amount).toBe(-250.0);
      expect(result.currency).toBe('PLN');
      expect(result.transactionDate).toBe('2025-12-09');
      expect(result.description).toBe('Opis część 1 część 2');
      expect(result.rawData).toEqual(mockRow);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.hash).toBeDefined();
    });

    it('concatenates description fields correctly', async () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Type',
        '100,00',
        'PLN',
        'Part1',
        'Part2',
        'Part3',
        'Part4',
      ];
      const result = await mapPKOBPRowToDBTransaction(mockRow);
      expect(result.description).toBe('Part1 Part2 Part3 Part4');
    });

    it('handles USD currency', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', 'Type', '99,99', 'USD', 'Description'];
      const result = await mapPKOBPRowToDBTransaction(mockRow);
      expect(result.currency).toBe('USD');
      expect(result.amount).toBe(99.99);
    });
  });

  describe('mapBankRowToDBTransaction', () => {
    it('routes to ING mapper for ING bank', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX', '-100,00', 'PLN'];
      const result = await mapBankRowToDBTransaction('ING', mockRow);
      expect(result.sourceBank).toBe('ING');
    });

    it('routes to PKOBP mapper for PKOBP bank', async () => {
      const mockRow = ['2025-12-09', '2025-12-09', 'Type', '-100,00', 'PLN', 'Desc'];
      const result = await mapBankRowToDBTransaction('PKOBP', mockRow);
      expect(result.sourceBank).toBe('PKOBP');
    });

    it('throws error for unsupported bank', async () => {
      const mockRow = ['data'];
      await expect(mapBankRowToDBTransaction('UNKNOWN_BANK', mockRow)).rejects.toThrow(
        'Unsupported bank: UNKNOWN_BANK'
      );
    });
  });

  describe('hash generation', () => {
    it('generates different hashes for different rows', async () => {
      const row1 = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX1', '-100,00', 'PLN'];
      const row2 = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX2', '-100,00', 'PLN'];

      const result1 = await mapINGRowToDBTransaction(row1);
      const result2 = await mapINGRowToDBTransaction(row2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('generates same hash for identical rows', async () => {
      const row = ['2025-12-09', '2025-12-09', '', '', '', '', '', 'TRX', '-100,00', 'PLN'];

      const result1 = await mapINGRowToDBTransaction(row);
      const result2 = await mapINGRowToDBTransaction(row);

      expect(result1.hash).toBe(result2.hash);
    });
  });
});

describe('allocateTransactionsToDuties', () => {
  it('lets one payment settle one occurrence, not every occurrence it falls near', () => {
    const allocation = allocateTransactionsToDuties({
      duties: [
        { id: 'duty-13th', executionDate: new Date(2026, 6, 13) },
        { id: 'duty-14th', executionDate: new Date(2026, 6, 14) },
        { id: 'duty-15th', executionDate: new Date(2026, 6, 15) },
      ],
      transactions: [{ id: 'the-only-payment', transactionDate: '2026-07-14' }],
    });

    expect(allocation).toEqual([{ dutyId: 'duty-14th', transactionId: 'the-only-payment' }]);
  });

  it('passes over a payment this occurrence was unlinked from, however close it lands', () => {
    const allocation = allocateTransactionsToDuties({
      duties: [
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

    expect(allocation).toEqual([{ dutyId: 'duty-15th', transactionId: 'the-right-one' }]);
  });

  it('leaves a payment already settled where it is, even when it sits closer to another occurrence', () => {
    const allocation = allocateTransactionsToDuties({
      duties: [
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
      { dutyId: 'duty-15th', transactionId: 'the-payment-on-record' },
    ]);
  });

  it('settles the older debt when a payment falls exactly between two occurrences', () => {
    const before = { id: 'z-duty-14th', executionDate: new Date(2026, 6, 14) };
    const after = { id: 'a-duty-16th', executionDate: new Date(2026, 6, 16) };
    const transactions = [{ id: 'the-only-payment', transactionDate: '2026-07-15' }];

    const asListed = allocateTransactionsToDuties({ duties: [before, after], transactions });
    const reversed = allocateTransactionsToDuties({ duties: [after, before], transactions });

    expect(asListed).toEqual([{ dutyId: 'z-duty-14th', transactionId: 'the-only-payment' }]);
    expect(reversed).toEqual(asListed);
  });

  it('settles with the earlier payment when two land equally close', () => {
    const earlier = { id: 'the-earlier-payment', transactionDate: '2026-07-14' };
    const later = { id: 'the-later-payment', transactionDate: '2026-07-16' };
    const duties = [{ id: 'duty-15th', executionDate: new Date(2026, 6, 15) }];

    const asListed = allocateTransactionsToDuties({ duties, transactions: [earlier, later] });
    const reversed = allocateTransactionsToDuties({ duties, transactions: [later, earlier] });

    expect(asListed).toEqual([{ dutyId: 'duty-15th', transactionId: 'the-earlier-payment' }]);
    expect(reversed).toEqual(asListed);
  });

  it('lets a payment reach a real occurrence past one the person said would not happen', () => {
    const allocation = allocateTransactionsToDuties({
      duties: [
        { id: 'duty-skipped', executionDate: new Date(2026, 6, 14), ignored: true },
        { id: 'duty-15th', executionDate: new Date(2026, 6, 15) },
      ],
      transactions: [{ id: 'the-only-payment', transactionDate: '2026-07-14' }],
    });

    expect(allocation).toEqual([{ dutyId: 'duty-15th', transactionId: 'the-only-payment' }]);
  });
});
