import type { Currency } from '@/constant.ts';
import type { ConvertedFrom } from '@/lib/exchange-rate.ts';

/** How much of what is held sits in one currency, and what part of the whole that is. */
export type CurrencyExposure = {
  currency: Currency;
  /** In the currency the screen reads in, so the lines add up to the figure above them. */
  value: number;
  /** Whole per cent. A tenth of a per cent of somebody's wealth is not a fact worth printing. */
  share: number;
};

/** A holding as the screen has it: already converted, still remembering what it came from. */
type ConvertedHolding = { value: number; currency: Currency; convertedFrom?: ConvertedFrom };

/**
 * Which currencies somebody's wealth actually sits in.
 *
 * The question a single converted figure hides. Reading in euro while holding in złoty means the net
 * worth falls whenever the złoty weakens — and not one złoty has left. Without this the drop reads
 * as something the person did, rather than a rate they are exposed to and could choose to be less
 * exposed to.
 *
 * Grouped by the currency each holding was **entered** in, and summed in the one the screen reads,
 * so the lines add up to the figure they sit under. `convertedFrom` is what carries the original — a
 * holding with none was entered in the screen's own currency, and the absence is what says so.
 *
 * **Nothing at all on a single currency.** "100% of your wealth is in złoty" told to somebody who
 * has only ever held złoty repeats what the figure above already implies, and a screen that says the
 * obvious teaches people to stop reading it.
 *
 * What is *held*, not what is owed: a mortgage in złoty offsets złoty savings, and netting the two
 * would report somebody with a big loan as barely exposed at all when the loan is the exposure they
 * cannot sell. Owing is its own question and this is not it.
 */
export const currencyExposure = (holdings: ConvertedHolding[]): CurrencyExposure[] => {
  const worth = new Map<Currency, number>();

  for (const holding of holdings) {
    if (!holding.value) continue;

    const entered = holding.convertedFrom?.currency ?? holding.currency;

    worth.set(entered, Number(((worth.get(entered) ?? 0) + holding.value).toFixed(2)));
  }

  if (worth.size < 2) return [];

  const total = [...worth.values()].reduce((sum, value) => sum + value, 0);

  return [...worth.entries()]
    .map(([currency, value]) => ({
      currency,
      value,
      share: Math.round((value / total) * 100),
    }))
    .sort((a, b) => b.value - a.value);
};
