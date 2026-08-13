import { ASSET_TYPE, PRICED_PER_UNIT } from '@/constant.ts';

/**
 * What "no type yet" is spelled as while the form is open.
 *
 * Not an empty string: a Radix select item may not carry one — it throws rather than rendering, and a
 * throw inside a drawer takes the page with it.
 */
export const UNTYPED = 'none';

/** The form's spelling of "not said", back to the absence the record stores. */
export const assetTypeFrom = (value?: string): ASSET_TYPE | undefined =>
  !value || value === UNTYPED ? undefined : (value as ASSET_TYPE);

/**
 * Whether this kind of holding is one somebody counts rather than one they weigh.
 *
 * The form asks for a count and a price where that is how a person actually knows what they hold, and
 * asks for neither where the question would be invented: a savings account has no unit price, and a
 * holding whose type nobody has said yet is not asked either.
 */
export const isPricedPerUnit = (type: ASSET_TYPE | undefined): boolean =>
  type !== undefined && PRICED_PER_UNIT.includes(type);

/**
 * What a counted holding is worth, from the count and the price.
 *
 * **The stored value stays the one figure every screen reads.** The count and the price record how it
 * was arrived at; they do not become a second source of truth. Two stored numbers that ought to agree
 * are two numbers that will one day disagree, with nothing to say which to believe — so the worth is
 * computed from them at the moment of saving and stored once.
 *
 * Nothing where either half is missing, because half of a multiplication is not a figure. Nought
 * units, though, is a real answer — somebody who sold everything holds none of it — and must read as
 * nothing rather than as "not said", which would leave the previous worth standing.
 */
export const worthFromUnits = ({
  units,
  unitPrice,
}: {
  units?: number;
  unitPrice?: number;
}): number | undefined =>
  units === undefined || unitPrice === undefined
    ? undefined
    : Number((units * unitPrice).toFixed(2));
