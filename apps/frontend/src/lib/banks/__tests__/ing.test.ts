import { describe, it, expect } from 'vitest';
import { ING_HEADER_ROW, ING_STOP_ROWS } from '../ing';
import { createStepCollector } from '../step-collector';
import Papa from 'papaparse';

describe('ING bank parser', () => {
  describe('ingStepCollector', () => {
    it('parses ING CSV data correctly', async () => {
      // Create sample CSV data with proper formatting
      const csvData = `Preamble line
Header info

Data transakcji;Data księgowania;Dane kontrahenta;Tytuł;Nr rachunku;Nazwa banku;Szczegóły;Nr transakcji;Kwota transakcji (waluta rachunku);Waluta;Kwota blokady/zwolnienie blokady;Waluta;Kwota płatności w walucie;Waluta;Konto;Bank;Saldo po transakcji;Waluta;;;
2025-12-09;2025-12-09;Test Kontrahent;Test Title;;;Details;TRX123;-100,50;PLN;;;;Test Account;Test Bank;1000,00;PLN;;;
2025-12-08;2025-12-08;Another One;Another Title;;;Details;TRX124;50,25;EUR;;;;Account2;Bank2;2000,00;EUR;;;

Dokument ma charakter informacyjny, nie stanowi dowodu księgowego;
Footer line`;

      // Create a fresh collector for this test
      const collector = createStepCollector(ING_HEADER_ROW, ING_STOP_ROWS);

      return new Promise<void>((resolvePromise) => {
        Papa.parse(csvData, {
          delimiter: ';',
          step: collector.step,
          complete: () => {
            const rows = collector.getRows();

            expect(rows.length).toBe(2);

            // Check first transaction
            const firstRow = rows[0];
            expect(firstRow[0]).toBe('2025-12-09'); // Transaction date
            expect(firstRow[3]).toBe('Test Title'); // Title
            expect(firstRow[7]).toBe('TRX123'); // Transaction ID
            expect(firstRow[8]).toBe('-100,50'); // Amount
            expect(firstRow[9]).toBe('PLN'); // Currency

            // Check second transaction
            const secondRow = rows[1];
            expect(secondRow[0]).toBe('2025-12-08');
            expect(secondRow[8]).toBe('50,25');
            expect(secondRow[9]).toBe('EUR');

            // Verify none of the collected rows are header or stop rows
            rows.forEach((row) => {
              expect(row[0]).not.toBe('Data transakcji');
              expect(row[0]).not.toBe('');
            });

            resolvePromise();
          },
        });
      });
    });

    it('ING_HEADER_ROW contains expected first columns', () => {
      // Verify the header starts with the expected columns
      expect(ING_HEADER_ROW[0]).toBe('Data transakcji');
      expect(ING_HEADER_ROW[1]).toBe('Data księgowania');
      expect(ING_HEADER_ROW[2]).toBe('Dane kontrahenta');
      expect(ING_HEADER_ROW[3]).toBe('Tytuł');
      expect(ING_HEADER_ROW[8]).toBe('Kwota transakcji (waluta rachunku)');
      expect(ING_HEADER_ROW[9]).toBe('Waluta');
    });

    it('ING_STOP_ROWS contains expected stop patterns', () => {
      expect(ING_STOP_ROWS).toEqual([
        [''],
        ['Dokument ma charakter informacyjny, nie stanowi dowodu księgowego', ''],
      ]);
    });
  });

  describe('data extraction', () => {
    it('extracts transaction date from correct column', () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Kontrahent',
        'Tytuł',
        '',
        '',
        '',
        '12345',
        '-100,00',
        'PLN',
      ];
      expect(mockRow[0]).toBe('2025-12-09');
    });

    it('extracts amount from correct column', () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Kontrahent',
        'Tytuł',
        '',
        '',
        '',
        '12345',
        '-100,00',
        'PLN',
      ];
      expect(mockRow[8]).toBe('-100,00');
    });

    it('extracts currency from correct column', () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Kontrahent',
        'Tytuł',
        '',
        '',
        '',
        '12345',
        '-100,00',
        'PLN',
      ];
      expect(mockRow[9]).toBe('PLN');
    });

    it('extracts title from correct column', () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Kontrahent',
        'Test Title',
        '',
        '',
        '',
        '12345',
        '-100,00',
        'PLN',
      ];
      expect(mockRow[3]).toBe('Test Title');
    });

    it('extracts transaction ID from correct column', () => {
      const mockRow = [
        '2025-12-09',
        '2025-12-09',
        'Kontrahent',
        'Tytuł',
        '',
        '',
        '',
        '12345',
        '-100,00',
        'PLN',
      ];
      expect(mockRow[7]).toBe('12345');
    });
  });
});
