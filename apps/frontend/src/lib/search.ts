/**
 * Text matching for the tables' search box.
 *
 * Two decisions worth stating, because both are what makes typing feel right rather than
 * technically correct:
 *
 * **Diacritics fold.** Somebody typing quickly writes "spozywcze" and "calkowita", and a search
 * that answers "no results" to those is wrong about its own data. `ł` needs naming explicitly —
 * it is a single character rather than a letter plus a combining mark, so `NFD` leaves it alone
 * where it decomposes `ż` and `ó` happily.
 *
 * **Every word has to appear, anywhere.** The fields of a row are searched as one run of text, so
 * "wysoki czynsz" finds the row whose description is "Czynsz" and whose priority is "Wysoki" —
 * two words that never sit next to each other in any single field. The cost of that reach is
 * precision: "wysoki" also matches a description containing the word. That is understood and
 * accepted; a facet filter would be the precise instrument and this is deliberately the broad one.
 */

export const normalizeForSearch = (text: string): string =>
  text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export const matchesSearch = (haystack: string, query: string): boolean => {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);

  // An empty box is not a filter. Returning `false` here would make a table look empty until
  // something is typed into it.
  if (!tokens.length) {
    return true;
  }

  const text = normalizeForSearch(haystack);

  return tokens.every((token) => text.includes(token));
};
