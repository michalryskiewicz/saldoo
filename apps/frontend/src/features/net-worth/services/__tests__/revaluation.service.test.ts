import { describe, expect, it } from 'vitest';
import { ASSET_TYPE } from '@/constant.ts';
import { asksForUnitPrice, revaluationsFrom } from '../revaluation.service.ts';

const TODAY = new Date(2026, 7, 13);
const MAY = new Date(2026, 4, 1);

const holding = (fields: {
  id: string;
  value: number;
  valuedOn?: Date;
  assetType?: ASSET_TYPE;
  units?: number;
  unitPrice?: number;
}) => ({ valuedOn: MAY, ...fields });

describe('asksForUnitPrice', () => {
  /**
   * What somebody reads off a broker for an ETF is the price of one, not the total — they would have
   * to multiply it themselves, which is the arithmetic this whole idea exists to stop asking for.
   */
  it('asks the price of one for a counted holding', () => {
    expect(asksForUnitPrice(holding({ id: 'etf', value: 432, assetType: ASSET_TYPE.ETF, units: 100 }))).toBe(
      true
    );
  });

  it('asks the total for everything else', () => {
    expect(
      asksForUnitPrice(holding({ id: 'konto', value: 5000, assetType: ASSET_TYPE.SAVINGS_ACCOUNT }))
    ).toBe(false);
  });

  /**
   * A counted holding nobody has said the count of cannot be re-valued by its unit price — there is
   * nothing to multiply by, so it is asked for its total like anything else.
   */
  it('asks the total for a counted holding with no count', () => {
    expect(asksForUnitPrice(holding({ id: 'etf', value: 432, assetType: ASSET_TYPE.ETF }))).toBe(false);
  });
});

describe('revaluationsFrom', () => {
  it('turns a figure typed against a plain holding into its new worth', () => {
    const konto = holding({ id: 'konto', value: 5000 });

    expect(revaluationsFrom([konto], { konto: 5200 }, TODAY)).toEqual([
      { positionId: 'konto', value: 5200, valuedOn: TODAY },
    ]);
  });

  /** For a counted holding the figure typed is the price of one, and the worth follows from the count. */
  it('multiplies a price typed against a counted holding', () => {
    const etf = holding({
      id: 'etf',
      value: 432,
      assetType: ASSET_TYPE.ETF,
      units: 100,
      unitPrice: 4.32,
    });

    expect(revaluationsFrom([etf], { etf: 4.5 }, TODAY)).toEqual([
      { positionId: 'etf', value: 450, unitPrice: 4.5, valuedOn: TODAY },
    ]);
  });

  it('leaves out the rows nobody filled in', () => {
    const konto = holding({ id: 'konto', value: 5000 });
    const skarbonka = holding({ id: 'skarbonka', value: 800 });

    expect(revaluationsFrom([konto, skarbonka], { konto: 5200 }, TODAY)).toEqual([
      { positionId: 'konto', value: 5200, valuedOn: TODAY },
    ]);
  });

  /**
   * A figure retyped unchanged on a *later* day is somebody confirming it still holds, and that is a
   * reading worth keeping — it is what an investment that did not move looks like.
   */
  it('keeps an unchanged figure said about a new day', () => {
    const konto = holding({ id: 'konto', value: 5000, valuedOn: MAY });

    expect(revaluationsFrom([konto], { konto: 5000 }, TODAY)).toEqual([
      { positionId: 'konto', value: 5000, valuedOn: TODAY },
    ]);
  });

  /** The same figure about the same day says nothing new, and filing it would only add a duplicate. */
  it('leaves out a figure that changes neither the worth nor the day', () => {
    const konto = holding({ id: 'konto', value: 5000, valuedOn: TODAY });

    expect(revaluationsFrom([konto], { konto: 5000 }, TODAY)).toEqual([]);
  });

  it('leaves out a holding it was not given', () => {
    expect(revaluationsFrom([], { gone: 100 }, TODAY)).toEqual([]);
  });

  /** Nought is a real answer — an account emptied is worth nothing — and must not read as "not filled in". */
  it('takes nought as a figure', () => {
    const konto = holding({ id: 'konto', value: 5000 });

    expect(revaluationsFrom([konto], { konto: 0 }, TODAY)).toEqual([
      { positionId: 'konto', value: 0, valuedOn: TODAY },
    ]);
  });
});

describe('a figure said about an earlier day', () => {
  /**
   * Filling in history must not rewrite the present. Somebody reconstructing last spring from a
   * statement is saying what a holding *was* worth — and a position holds the latest reading, so
   * moving its worth and its date backwards would quietly replace today's figure with an old one.
   *
   * The reading is still filed, because that is the whole point of entering it: the line needs it.
   */
  it('is filed as history without moving what the holding is worth now', () => {
    const konto = holding({ id: 'konto', value: 5000, valuedOn: TODAY });

    expect(revaluationsFrom([konto], { konto: 4200 }, MAY)).toEqual([
      { positionId: 'konto', value: 4200, valuedOn: MAY, historyOnly: true },
    ]);
  });

  it('is not history when it is about the same day the holding already speaks for', () => {
    const konto = holding({ id: 'konto', value: 5000, valuedOn: MAY });

    expect(revaluationsFrom([konto], { konto: 4200 }, MAY)?.[0]?.historyOnly).toBeUndefined();
  });

  it('is not history when it is about a later day', () => {
    const konto = holding({ id: 'konto', value: 5000, valuedOn: MAY });

    expect(revaluationsFrom([konto], { konto: 5200 }, TODAY)?.[0]?.historyOnly).toBeUndefined();
  });
});

describe('the day, not the instant', () => {
  /**
   * A holding's `valuedOn` is stamped with a clock time — `new Date()` when the form saved it — while a
   * pass names a bare date at midnight. Compared as moments, every re-valuation entered on the same day
   * looked earlier than the holding it was about, and was filed as history: the figure somebody typed
   * to be the current worth silently was not.
   */
  it('treats a figure about today as today, whatever time the holding was stamped', () => {
    const stampedThisAfternoon = holding({
      id: 'konto',
      value: 5000,
      valuedOn: new Date(2026, 7, 13, 14, 32),
    });
    const midnight = new Date(2026, 7, 13);

    expect(revaluationsFrom([stampedThisAfternoon], { konto: 5200 }, midnight)).toEqual([
      { positionId: 'konto', value: 5200, valuedOn: midnight },
    ]);
  });
});
