import { describe, expect, it } from 'vitest';
import { paidInAndGrown } from '../paid-in-and-grown.service.ts';

const holding = (
  id: string,
  value: number,
  assignments: { goalId: string; share: number }[] = []
) => ({ id, value, currency: 'PLN' as const, assignments });

const putAside = (goalId: string, amount: number) => ({ goalId, amount });

describe('paidInAndGrown', () => {
  /**
   * The fact anybody investing by hand actually wants, and the one a single value cannot carry:
   * 3 000 in an account says nothing about whether it was earned or paid in. Declaring 2 500 into a
   * goal and finding 3 000 in the account it sits in means 500 was earned — and the declarations,
   * which stopped counting towards progress the moment the holding was assigned, are exactly the
   * record of what went in.
   */
  it('splits what was put in from what the holding earned', () => {
    const konto = holding('konto', 3000, [{ goalId: 'ike', share: 100 }]);

    expect(paidInAndGrown('konto', [konto], [putAside('ike', 2000), putAside('ike', 500)])).toEqual({
      positionId: 'konto',
      paidIn: 2500,
      grown: 500,
      currency: 'PLN',
    });
  });

  it('reports a holding worth less than went into it as having lost', () => {
    const akcje = holding('akcje', 8000, [{ goalId: 'wolnosc', share: 100 }]);

    expect(paidInAndGrown('akcje', [akcje], [putAside('wolnosc', 10000)])?.grown).toBe(-2000);
  });

  it('counts nothing put in as all of it being growth', () => {
    // A holding assigned to a goal nobody ever declared into: every złoty in it arrived some other
    // way, and saying so is more useful than saying nothing.
    const konto = holding('konto', 3000, [{ goalId: 'ike', share: 100 }]);

    expect(paidInAndGrown('konto', [konto], [])).toEqual({
      positionId: 'konto',
      paidIn: 0,
      grown: 3000,
      currency: 'PLN',
    });
  });

  it('ignores declarations made into other goals', () => {
    const konto = holding('konto', 3000, [{ goalId: 'ike', share: 100 }]);

    expect(
      paidInAndGrown('konto', [konto], [putAside('ike', 2500), putAside('wakacje', 9000)])?.paidIn
    ).toBe(2500);
  });

  describe('where the arrangement does not say', () => {
    /**
     * Each of these is a case the app would have to *guess* at, and the whole point of this figure is
     * that it is a fact. Silence is the honest answer: the column simply has nothing for that row.
     */
    it('says nothing about a holding pointed at nothing', () => {
      expect(paidInAndGrown('konto', [holding('konto', 3000)], [])).toBeUndefined();
    });

    it('says nothing where only part of the holding serves the goal', () => {
      // 60% of an account towards a goal: which 60% of the declarations landed here is unanswerable.
      const konto = holding('konto', 3000, [{ goalId: 'ike', share: 60 }]);

      expect(paidInAndGrown('konto', [konto], [putAside('ike', 2500)])).toBeUndefined();
    });

    it('says nothing where the holding serves more than one goal', () => {
      const konto = holding('konto', 3000, [
        { goalId: 'ike', share: 50 },
        { goalId: 'wakacje', share: 50 },
      ]);

      expect(paidInAndGrown('konto', [konto], [putAside('ike', 2500)])).toBeUndefined();
    });

    /**
     * Two accounts both wholly serving one goal: the declarations went into one of them, or across
     * both, and nothing recorded which. Splitting them evenly would be the app inventing a fact.
     */
    it('says nothing where another holding serves the same goal', () => {
      const konto = holding('konto', 3000, [{ goalId: 'ike', share: 100 }]);
      const drugie = holding('drugie', 1000, [{ goalId: 'ike', share: 100 }]);

      expect(paidInAndGrown('konto', [konto, drugie], [putAside('ike', 2500)])).toBeUndefined();
    });

    it('says nothing about a holding it was not given', () => {
      expect(paidInAndGrown('gone', [holding('konto', 3000)], [])).toBeUndefined();
    });
  });

  /** Rounded as money, or two figures a hundredth apart report growth of 1e-13. */
  it('reports the difference as money rather than as floating point', () => {
    const konto = holding('konto', 1000.2, [{ goalId: 'ike', share: 100 }]);

    expect(paidInAndGrown('konto', [konto], [putAside('ike', 1000.1)])?.grown).toBe(0.1);
  });
});
