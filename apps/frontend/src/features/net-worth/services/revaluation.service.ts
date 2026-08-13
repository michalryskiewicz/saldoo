import type { ASSET_TYPE } from '@/constant.ts';
import { isNewReading } from '@/features/net-worth/services/valuation-history.service.ts';
import {
  isPricedPerUnit,
  worthFromUnits,
} from '@/features/net-worth/services/unit-priced-worth.service.ts';

/** Everything about a holding this needs, which is less than a position carries. */
type Revaluable = {
  id: string;
  value: number;
  valuedOn: Date;
  assetType?: ASSET_TYPE;
  units?: number;
  unitPrice?: number;
};

/** One holding's new worth, ready for the write that stores it. */
export type Revaluation = {
  positionId: string;
  value: number;
  /** Present only where the figure typed was the price of one. */
  unitPrice?: number;
  valuedOn: Date;
};

/**
 * Whether this holding should be asked for the price of one rather than for its total.
 *
 * What somebody reads off a broker for an ETF is the price of one — asking for the total makes them do
 * the multiplication, which is the arithmetic this whole screen exists to stop asking for.
 *
 * A counted holding whose count nobody has said is asked for its total like anything else: there is
 * nothing to multiply by, and inventing a count would be worse than asking a plainer question.
 */
export const asksForUnitPrice = (holding: Revaluable): boolean =>
  isPricedPerUnit(holding.assetType) && holding.units !== undefined;

/**
 * A pass over every holding, turned into the writes it asks for.
 *
 * Typing prices in by hand is not the tiring part — opening a drawer, finding the field, saving and
 * closing it, once per holding, is. So this takes one figure per holding and **one date for the whole
 * pass**: a re-valuation is somebody saying what these are worth *today*, and asking the date per row
 * would be asking the same question five times.
 *
 * The shared date also settles something that was awkward elsewhere: a change is only a change against
 * an earlier day, and here the day is explicit rather than guessed at.
 *
 * **Blank rows are left alone, and nought is not blank.** An emptied account is worth nothing and that
 * is a figure; a row nobody touched is not an instruction.
 *
 * A figure that changes neither the worth nor the day is dropped, because filing it would add a
 * duplicate reading that says nothing. Retyped unchanged on a *later* day it is kept — that is somebody
 * confirming it still holds, which is exactly what an investment that has not moved looks like.
 */
export const revaluationsFrom = (
  holdings: Revaluable[],
  entered: Record<string, number | undefined>,
  valuedOn: Date
): Revaluation[] =>
  holdings.flatMap((holding) => {
    const figure = entered[holding.id];

    if (figure === undefined) return [];

    const asUnitPrice = asksForUnitPrice(holding);
    const value = asUnitPrice
      ? (worthFromUnits({ units: holding.units, unitPrice: figure }) ?? holding.value)
      : figure;

    if (!isNewReading({ value, valuedOn }, holding)) return [];

    return [
      {
        positionId: holding.id,
        value,
        ...(asUnitPrice ? { unitPrice: figure } : {}),
        valuedOn,
      },
    ];
  });
