import { describe, it, expect } from 'vitest';
import { parserFromMapping, parseStatementDate, type CsvMapping } from '../mapping';

const mapping = (overrides: Partial<CsvMapping> = {}): CsvMapping => ({
  id: 'm1',
  name: 'mBank osobiste',
  version: 1,
  encoding: 'utf-8',
  delimiter: ';',
  headerRow: ['Data', 'Opis', 'Kwota'],
  columns: { date: 0, description: 1, amount: 2 },
  dateFormat: 'DD.MM.YYYY',
  ...overrides,
});

describe('parseStatementDate', () => {
  it('reads each order it offers, and writes them all the same way', () => {
    expect(parseStatementDate('2026-03-04', 'YYYY-MM-DD')).toBe('2026-03-04');
    expect(parseStatementDate('04.03.2026', 'DD.MM.YYYY')).toBe('2026-03-04');
    expect(parseStatementDate('04/03/2026', 'DD/MM/YYYY')).toBe('2026-03-04');
    expect(parseStatementDate('04-03-2026', 'DD-MM-YYYY')).toBe('2026-03-04');
    expect(parseStatementDate('03/04/2026', 'MM/DD/YYYY')).toBe('2026-03-04');
  });

  it('pads a day and month written without their nought', () => {
    expect(parseStatementDate('4.3.2026', 'DD.MM.YYYY')).toBe('2026-03-04');
  });

  it('refuses a day that does not exist, however well it is shaped', () => {
    expect(parseStatementDate('31.02.2026', 'DD.MM.YYYY')).toBeUndefined();
  });

  it('refuses what is not a date at all', () => {
    expect(parseStatementDate('Saldo', 'DD.MM.YYYY')).toBeUndefined();
    expect(parseStatementDate('', 'DD.MM.YYYY')).toBeUndefined();
    expect(parseStatementDate(undefined, 'DD.MM.YYYY')).toBeUndefined();
  });
});

describe('parserFromMapping', () => {
  const rows = [
    ['Wyciąg za marzec'],
    ['Data', 'Opis', 'Kwota'],
    ['04.03.2026', 'BIEDRONKA', '-213,47'],
    ['05.03.2026', 'Wynagrodzenie', '12 500,00'],
  ];

  it('reads what the person said the columns mean', () => {
    const { transactions, warnings } = parserFromMapping(mapping()).parse(rows);

    expect(warnings).toEqual([]);
    expect(transactions).toEqual([
      expect.objectContaining({
        transactionDate: '2026-03-04',
        description: 'BIEDRONKA',
        amount: -213.47,
      }),
      expect.objectContaining({
        transactionDate: '2026-03-05',
        description: 'Wynagrodzenie',
        amount: 12500,
      }),
    ]);
  });

  it('starts at the first row when the file has no header to find', () => {
    const { transactions } = parserFromMapping(mapping({ headerRow: [] })).parse([
      ['04.03.2026', 'BIEDRONKA', '-213,47'],
    ]);

    expect(transactions).toHaveLength(1);
  });

  it('recognises next month\'s export from the same bank, and nothing else', () => {
    const parser = parserFromMapping(mapping());

    expect(parser.detect(rows)).toBe(1);
    expect(parser.detect([['Date', 'Amount']])).toBe(0);
  });

  it('does not offer to recognise a file when the mapping has no header to go by', () => {
    expect(parserFromMapping(mapping({ headerRow: [] })).detect(rows)).toBe(0);
  });

  describe('money in one column or two', () => {
    const split = mapping({
      headerRow: ['Data', 'Opis', 'Obciążenia', 'Uznania'],
      columns: { date: 0, description: 1, debit: 2, credit: 3 },
    });

    const splitRows = [
      ['Data', 'Opis', 'Obciążenia', 'Uznania'],
      ['04.03.2026', 'BIEDRONKA', '213,47', ''],
      ['05.03.2026', 'Wynagrodzenie', '', '12 500,00'],
    ];

    it('reads money out of a debit column as money leaving, whatever sign the bank wrote', () => {
      const { transactions } = parserFromMapping(split).parse(splitRows);

      expect(transactions[0].amount).toBe(-213.47);
      expect(transactions[1].amount).toBe(12500);
    });

    it('reads a row that fills both columns as the difference rather than refusing it', () => {
      const { transactions } = parserFromMapping(split).parse([
        ['Data', 'Opis', 'Obciążenia', 'Uznania'],
        ['04.03.2026', 'Korekta', '100,00', '30,00'],
      ]);

      expect(transactions[0].amount).toBe(-70);
    });

    it('reports a row where neither column holds a figure', () => {
      const { transactions, warnings } = parserFromMapping(split).parse([
        ['Data', 'Opis', 'Obciążenia', 'Uznania'],
        ['04.03.2026', 'Nic', '', ''],
      ]);

      expect(transactions).toEqual([]);
      expect(warnings).toEqual([{ row: 1, reason: 'unreadable-amount' }]);
    });
  });

  it('says which row it could not read, by the number a person would count to', () => {
    const { transactions, warnings } = parserFromMapping(mapping()).parse([
      ['Data', 'Opis', 'Kwota'],
      ['04.03.2026', 'BIEDRONKA', '-213,47'],
      ['Saldo końcowe', '', '1 000,00'],
    ]);

    expect(transactions).toHaveLength(1);
    expect(warnings).toEqual([{ row: 2, reason: 'no-date' }]);
  });

  it('passes over the blank line every CSV ends with instead of reporting it', () => {
    const { warnings } = parserFromMapping(mapping()).parse([
      ['Data', 'Opis', 'Kwota'],
      ['04.03.2026', 'BIEDRONKA', '-213,47'],
      ['', '', ''],
    ]);

    expect(warnings).toEqual([]);
  });

  it('takes the currency from the file where it is stated and from the mapping where it is not', () => {
    const stated = parserFromMapping(
      mapping({
        headerRow: ['Data', 'Opis', 'Kwota', 'Waluta'],
        columns: { date: 0, description: 1, amount: 2, currency: 3 },
      })
    ).parse([
      ['Data', 'Opis', 'Kwota', 'Waluta'],
      ['04.03.2026', 'Hotel', '-90,00', 'EUR'],
    ]);

    expect(stated.transactions[0].currency).toBe('EUR');

    const assumed = parserFromMapping(mapping({ currency: 'PLN' })).parse(rows);

    expect(assumed.transactions[0].currency).toBe('PLN');
  });

  it('joins a counterparty onto the description, and not twice', () => {
    const withCounterparty = mapping({
      headerRow: ['Data', 'Opis', 'Kwota', 'Kontrahent'],
      columns: { date: 0, description: 1, amount: 2, counterparty: 3 },
    });

    const { transactions } = parserFromMapping(withCounterparty).parse([
      ['Data', 'Opis', 'Kwota', 'Kontrahent'],
      ['04.03.2026', 'Przelew', '-100,00', 'Jan Kowalski'],
      ['05.03.2026', 'Przelew do Jan Kowalski', '-100,00', 'Jan Kowalski'],
    ]);

    expect(transactions[0].description).toBe('Przelew — Jan Kowalski');
    expect(transactions[1].description).toBe('Przelew do Jan Kowalski');
  });
});
