import { describe, it, expect } from 'vitest';
import {
  mapINGRowToDBTransaction,
  mapPKOBPRowToDBTransaction,
  mapBankRowToDBTransaction,
  selectTransactionForDuty,
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

describe('selectTransactionForDuty', () => {
  it('skips a transaction the user unlinked and takes the next one in the window', () => {
    const chosen = selectTransactionForDuty({
      executionDate: new Date(2026, 6, 15),
      rejectedTransactionIds: ['the-wrong-one'],
      transactions: [
        { id: 'the-wrong-one', transactionDate: '2026-07-13' },
        { id: 'the-right-one', transactionDate: '2026-07-16' },
      ],
    });

    expect(chosen?.id).toBe('the-right-one');
  });
});
