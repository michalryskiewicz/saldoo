import { describe, it, expect } from 'vitest';
import { headerConfidence, parseAmount, statementRows } from '../statement';

describe('statementRows', () => {
  it('collects rows after the header and before the row that ends the table', () => {
    const rows = statementRows(
      [
        ['Some', 'preamble', 'data'],
        ['Column1', 'Column2', 'Column3'],
        ['Row1', 'Data1', 'Value1'],
        ['Row2', 'Data2', 'Value2'],
        ['End of data'],
        ['Should', 'not', 'collect'],
      ],
      ['Column1', 'Column2', 'Column3'],
      [['End of data']]
    );

    expect(rows).toEqual([
      ['Row1', 'Data1', 'Value1'],
      ['Row2', 'Data2', 'Value2'],
    ]);
  });

  it('matches a header that carries trailing columns of its own', () => {
    const rows = statementRows(
      [
        ['Col1', 'Col2', 'Col3', 'Col4', 'Col5'],
        ['Data1', 'Data2', 'Data3', 'Data4', 'Data5'],
        [''],
      ],
      ['Col1', 'Col2', 'Col3'],
      [['']]
    );

    expect(rows).toEqual([['Data1', 'Data2', 'Data3', 'Data4', 'Data5']]);
  });

  it('leaves everything above the header alone', () => {
    const rows = statementRows(
      [
        ['Before', 'header'],
        ['Still', 'before'],
        ['Header1', 'Header2'],
        ['After', 'header'],
        ['END'],
      ],
      ['Header1', 'Header2'],
      [['END']]
    );

    expect(rows).toEqual([['After', 'header']]);
  });

  it('stops at the first of several possible stop rows', () => {
    const rows = statementRows(
      [['H1'], ['Row1'], ['STOP1'], ['Row2']],
      ['H1'],
      [['STOP1'], ['STOP2']]
    );

    expect(rows).toEqual([['Row1']]);
  });

  it('reads a stop row by its values, so a padded one still ends the table', () => {
    const rows = statementRows([['H1'], ['Row1'], ['', ''], ['Row2']], ['H1'], [['']]);

    expect(rows).toEqual([['Row1']]);
  });

  it('finds nothing when the header never appears', () => {
    expect(statementRows([['Some', 'data'], ['More', 'data']], ['Header'], [['END']])).toEqual([]);
  });

  it('picks the table up again where a statement repeats its header', () => {
    const rows = statementRows(
      [['Col'], ['Data1'], ['Col'], ['Data2'], ['END']],
      ['Col'],
      [['END']]
    );

    expect(rows).toEqual([['Data1'], ['Data2']]);
  });

  it('carries nothing between two files, because it keeps nothing', () => {
    const header = ['Col'];
    const first = statementRows([['Col'], ['First']], header, [['END']]);
    const second = statementRows([['Col'], ['Second']], header, [['END']]);

    expect(first).toEqual([['First']]);
    expect(second).toEqual([['Second']]);
  });
});

describe('headerConfidence', () => {
  it('is certain when the header is there intact', () => {
    expect(headerConfidence([['x'], ['Data', 'Kwota', 'Waluta']], ['Data', 'Kwota', 'Waluta'])).toBe(
      1
    );
  });

  it('is certain when the header is there with extra columns behind it', () => {
    expect(headerConfidence([['Data', 'Kwota', 'Waluta', '', '']], ['Data', 'Kwota', 'Waluta'])).toBe(
      1
    );
  });

  it('is nothing for a file that shares no label with it', () => {
    expect(headerConfidence([['Date', 'Amount']], ['Data', 'Kwota', 'Waluta'])).toBe(0);
  });

  it('scores a header that has lost a column, so it can still be offered as a guess', () => {
    expect(headerConfidence([['Data', 'Kwota', 'Tytuł']], ['Data', 'Kwota', 'Waluta'])).toBeCloseTo(
      2 / 3
    );
  });

  it('ignores the blank padding, so a file of empty rows matches nobody', () => {
    expect(headerConfidence([['', '', ''], ['']], ['Data', 'Kwota', '', '', ''])).toBe(0);
  });
});

describe('parseAmount', () => {
  it('reads a figure written the Polish way', () => {
    expect(parseAmount('-123,45')).toBe(-123.45);
  });

  it('reads thousands separated by a space, which parseFloat gets wrong by a factor of a thousand', () => {
    expect(parseAmount('-1 234,56')).toBe(-1234.56);
    expect(parseAmount('1 234,56')).toBe(1234.56);
  });

  it('reads a plain number and a figure that is already a number', () => {
    expect(parseAmount('1000.50')).toBe(1000.5);
    expect(parseAmount(42)).toBe(42);
  });

  it('keeps nought, which is a figure somebody may really have been charged', () => {
    expect(parseAmount('0,00')).toBe(0);
  });

  it('says nothing rather than nought when the cell cannot be read', () => {
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('   ')).toBeUndefined();
    expect(parseAmount('brak')).toBeUndefined();
    expect(parseAmount(undefined)).toBeUndefined();
    expect(parseAmount(null)).toBeUndefined();
  });
});
