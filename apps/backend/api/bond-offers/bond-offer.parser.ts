/** What one issue page says, once the markup is out of the way. */
export type ParsedIssue = {
  /** The rate of the first interest period, as a percentage. */
  ratePercent: number;
  /** Percentage points over inflation or over the reference rate, where the issue has one. */
  marginPercent?: number;
  /**
   * The price of one bond, which has been 100 zł for every retail series for years — read rather
   * than assumed, because a series that changed it would otherwise be silently wrong.
   */
  nominal?: number;
  /** `YYYY-MM` of the month it was on sale. */
  soldIn?: string;
};

/**
 * No retail issue has ever paid this, so anything above it is a misread page rather than a bargain.
 * A parser that swallows a stray "53,50" writes a confident lie into the cache.
 */
const HIGHEST_CREDIBLE_RATE = 15;

const decimal = (value: string) => Number(value.replace(',', '.'));

/**
 * Markup out, one line of text in.
 *
 * Every figure on these pages sits in its own element, so a pattern run against the raw HTML finds
 * the label and the value with tags in between and matches nothing. The first version of this
 * parser read the rate — which happens to share an element with its label — and quietly missed the
 * price and the sale period on every real page while passing against hand-written fixtures.
 */
const asText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gu, ' ')
    .replace(/<style[\s\S]*?<\/style>/gu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;|&#160;/gu, ' ')
    .replace(/\s+/gu, ' ');

/**
 * The one anchor every series shares. The sentence after it differs — *w pierwszym rocznym okresie
 * odsetkowym*, *w skali roku, w pierwszym miesięcznym…*, or for the fixed-rate three-year simply
 * *stałe przez cały 3-letni okres oszczędzania* — so anchoring on the sentence read six series and
 * silently skipped TOS.
 */
const RATE = /Oprocentowanie:\s*(\d+,\d+)\s*%/u;
const MARGIN = /marża\s+(\d+,\d+)\s*%/u;
const NOMINAL = /Cena sprzedaży jednej obligacji:\s*(\d+,\d+)\s*zł/u;
const SOLD = /Sprzedaż:\s*\d{2}\.(\d{2})\.(\d{4})/u;

/**
 * Reads one issue page.
 *
 * **Nothing rather than a guess.** A redesigned page, a 404 body, or an issue that has not been
 * published yet all come back undefined, so the caller keeps the last good value instead of writing
 * a number nobody published. That is the whole safety property of reading a page somebody else
 * owns: it is allowed to stop working, and it is not allowed to be quietly wrong.
 */
export const parseIssuePage = (html: string): ParsedIssue | undefined => {
  const text = asText(html);

  const rate = RATE.exec(text);
  if (!rate) return undefined;

  const ratePercent = decimal(rate[1]);
  if (ratePercent <= 0 || ratePercent > HIGHEST_CREDIBLE_RATE) return undefined;

  const margin = MARGIN.exec(text);
  const nominal = NOMINAL.exec(text);
  const sold = SOLD.exec(text);

  return {
    ratePercent,
    marginPercent: margin ? decimal(margin[1]) : undefined,
    nominal: nominal ? decimal(nominal[1]) : undefined,
    soldIn: sold ? `${sold[2]}-${sold[1]}` : undefined,
  };
};
