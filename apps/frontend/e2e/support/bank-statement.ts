/**
 * An ING statement, byte for byte the way the bank exports one.
 *
 * The app parses uploads as `cp1250` (`lib/transactions.ts`), so a UTF-8 file with Polish
 * letters in it arrives as mojibake — which looks like a rendering defect and is not one. The
 * encoder below is the whole reason this file exists: the fixture has to be the encoding the
 * parser is told to expect, or the screenshots it feeds are of a bug in the harness.
 */

import { ING_HEADER_ROW } from '../../src/lib/banks/ing.ts';

/**
 * The Polish letters, where cp1250 puts them.
 *
 * Only the ones the fixtures use, and unknown bytes throw rather than being dropped: a
 * silently mangled statement is exactly the kind of thing a screenshot cannot tell from a
 * layout problem.
 */
const CP1250: Record<string, number> = {
  ą: 0xb9,
  ć: 0xe6,
  ę: 0xea,
  ł: 0xb3,
  ń: 0xf1,
  ó: 0xf3,
  ś: 0x9c,
  ź: 0x9f,
  ż: 0xbf,
  Ą: 0xa5,
  Ć: 0xc6,
  Ę: 0xca,
  Ł: 0xa3,
  Ń: 0xd1,
  Ó: 0xd3,
  Ś: 0x8c,
  Ź: 0x8f,
  Ż: 0xaf,
};

const encodeCp1250 = (text: string): Buffer =>
  Buffer.from(
    [...text].map((character) => {
      const code = character.codePointAt(0)!;
      if (code < 0x80) return code;

      const mapped = CP1250[character];
      if (mapped === undefined) {
        throw new Error(`No cp1250 byte for ${JSON.stringify(character)} — add it or avoid it.`);
      }

      return mapped;
    })
  );

export type StatementEntry = {
  /** ISO, the way the bank writes it. */
  date: string;
  title: string;
  /** Negative for money leaving the account, as the bank reports it. */
  amount: number;
  currency?: string;
};

/**
 * The columns the mapper reads, at the indices it reads them from
 * (`database/services/transactions.service.ts`): date, title, transaction number, amount,
 * currency. The rest are padding the real export carries and the app ignores.
 */
const toRow = ({ date, title, amount, currency = 'PLN' }: StatementEntry, index: number) => {
  const row = Array<string>(ING_HEADER_ROW.length).fill('');

  row[0] = date;
  row[1] = date;
  row[3] = title;
  row[7] = `E2E${String(index).padStart(6, '0')}`;
  row[8] = amount.toFixed(2).replace('.', ',');
  row[9] = currency;

  return row;
};

/**
 * The statement, preamble and all.
 *
 * The rows before the header are not decoration: the parser starts collecting *at* the header
 * row and stops at the footer, so a file that jumps straight to the data would exercise a code
 * path no real export takes.
 */
export const ingStatement = (entries: StatementEntry[]): Buffer => {
  const lines = [
    'Lista transakcji',
    '',
    ING_HEADER_ROW.join(';'),
    ...entries.map((entry, index) => toRow(entry, index).join(';')),
    '',
    'Dokument ma charakter informacyjny, nie stanowi dowodu księgowego;',
  ];

  return encodeCp1250(lines.join('\r\n'));
};
