import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeForSearch } from '../search.ts';

describe('normalizeForSearch', () => {
  it('folds Polish diacritics away', () => {
    expect(normalizeForSearch('Zakupy spożywcze')).toBe('zakupy spozywcze');
    expect(normalizeForSearch('Wrzesień')).toBe('wrzesien');
  });

  it('folds ł, which NFD leaves alone', () => {
    // Not a letter plus a combining mark, so it has to be named explicitly. Without this,
    // "calkowita" found nothing.
    expect(normalizeForSearch('Całkowita')).toBe('calkowita');
    expect(normalizeForSearch('ŁÓDŹ')).toBe('lodz');
  });
});

describe('matchesSearch', () => {
  it('matches regardless of case', () => {
    expect(matchesSearch('Czynsz', 'czynsz')).toBe(true);
    expect(matchesSearch('czynsz', 'CZYNSZ')).toBe(true);
  });

  it('matches text typed without its diacritics', () => {
    expect(matchesSearch('Zakupy spożywcze', 'spozywcze')).toBe(true);
  });

  it('matches part of a word, so results narrow as you type', () => {
    expect(matchesSearch('Ubezpieczenie samochodu', 'ubez')).toBe(true);
  });

  it('requires every word, in any order and in any field', () => {
    // The row's fields are searched as one run of text: this is the case the whole thing exists
    // for -- a description and a priority that never sit together in one field.
    const row = 'Czynsz Wysoki Miesięczna';

    expect(matchesSearch(row, 'wysoki czynsz')).toBe(true);
    expect(matchesSearch(row, 'czynsz wysoki')).toBe(true);
    expect(matchesSearch(row, 'czynsz niski')).toBe(false);
  });

  it('ignores the spacing somebody typed', () => {
    expect(matchesSearch('Czynsz Wysoki', '  czynsz   wysoki  ')).toBe(true);
  });

  it('treats an empty query as no filter at all', () => {
    expect(matchesSearch('cokolwiek', '')).toBe(true);
    expect(matchesSearch('cokolwiek', '   ')).toBe(true);
  });

  it('says no when a word simply is not there', () => {
    expect(matchesSearch('Czynsz', 'kawa')).toBe(false);
  });
});
