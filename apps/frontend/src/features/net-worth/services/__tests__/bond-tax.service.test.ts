import { describe, expect, it } from 'vitest';
import type { BondValue } from '../bond-accrual.service.ts';
import { afterTax } from '../bond-tax.service.ts';

const worth = (capital: number, accrued: number): BondValue => ({
  capital,
  capitalised: accrued,
  accruing: 0,
  accrued,
  paidOut: 0,
  value: capital + accrued,
});

describe('afterTax', () => {
  /** Belka is a tax on the gain. The money that was put in has already been taxed once. */
  it('takes 19% of the interest and nothing of the capital', () => {
    expect(afterTax(worth(10000, 1000), 'none')).toBe(10810);
  });

  it('taxes a holding with no gain at exactly what was paid for it', () => {
    expect(afterTax(worth(10000, 0), 'none')).toBe(10000);
  });

  /** The whole point of the wrapper, and the reason it is worth saying which bonds are in one. */
  it('leaves an IKE holding alone', () => {
    expect(afterTax(worth(10000, 1000), 'IKE')).toBe(11000);
  });

  /**
   * IKZE is not a lower Belka — it is 10% of **everything** paid out, capital included. Early in a
   * holding's life that is worse than no wrapper at all, and worse than what was paid in. The
   * screen has to be able to say so, which it cannot if this is modelled as a rate on the gain.
   */
  it('takes 10% of the whole payout on IKZE, capital and all', () => {
    expect(afterTax(worth(10000, 1000), 'IKZE')).toBe(9900);
  });

  it('can leave an IKZE holding worth less than was put into it', () => {
    expect(afterTax(worth(10000, 100), 'IKZE')).toBe(9090);
  });

  /** Records written before wrappers existed are ordinary holdings, and taxed like them. */
  it('treats a holding with no wrapper as an ordinary one', () => {
    expect(afterTax(worth(10000, 1000))).toBe(10810);
  });

  /**
   * Interest a paying bond already sent to somebody's account was taxed on its way there. What is
   * left to tax is only what is still inside the bond.
   */
  it('taxes only what the bond still holds, not what it has already paid out', () => {
    const coi: BondValue = {
      capital: 10000,
      capitalised: 0,
      accruing: 200,
      accrued: 200,
      paidOut: 1310,
      value: 10200,
    };

    expect(afterTax(coi, 'none')).toBe(10162);
  });
});
