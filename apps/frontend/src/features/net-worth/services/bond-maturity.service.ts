import { addMonths, startOfDay } from 'date-fns';
import type { DBBondHolding } from '@/database/bonds.ts';
import {
  choiceFromCode,
  monthStart,
  seriesByCode,
} from '@/features/net-worth/services/bond-catalogue.service.ts';

/**
 * The day a holding is redeemed.
 *
 * Derived, never stored: the issuer already puts it in the name. A ten-year sold in March 2025 is
 * called EDO0335 because that is when it comes back, so the series and the month it was bought in
 * are enough — and a second copy of the date on the record could disagree with the name printed
 * beside it.
 *
 * `undefined` where the name carries no series the catalogue knows. Falling back to a guess would
 * invent a tenor for a holding somebody typed in themselves, and the whole point of this figure is
 * that it is not a guess.
 */
export const maturityOf = (holding: DBBondHolding): Date | undefined => {
  const choice = choiceFromCode(holding.description);

  if (!choice) return undefined;

  return startOfDay(addMonths(monthStart(choice.month), seriesByCode(choice.code).tenorMonths));
};

/** The furthest redemption among them — past it there is nothing left to draw. */
export const lastMaturity = (holdings: DBBondHolding[]): Date | undefined =>
  holdings
    .map(maturityOf)
    .filter((day): day is Date => Boolean(day))
    .reduce<Date | undefined>((latest, day) => (!latest || day > latest ? day : latest), undefined);
