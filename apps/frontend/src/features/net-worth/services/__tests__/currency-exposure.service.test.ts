import { describe, expect, it } from 'vitest';
import { currencyExposure } from '../currency-exposure.service.ts';

/** A holding as the screen has it: already converted, still remembering what it came from. */
const held = (value: number, currency: 'PLN' | 'EUR' | 'USD', from?: 'PLN' | 'EUR' | 'USD') => ({
  value,
  currency,
  convertedFrom: from ? { amount: 0, currency: from } : undefined,
});

describe('currencyExposure', () => {
  /**
   * The question somebody reading in euro while holding in złoty cannot otherwise ask: when the
   * złoty weakens their net worth falls, and not one złoty has left. A single converted figure hides
   * that entirely — it looks like a loss the person made rather than a rate they are exposed to.
   */
  it('groups what is held by the currency it was entered in', () => {
    const exposure = currencyExposure([
      held(6512, 'EUR', 'PLN'),
      held(464, 'EUR'),
    ]);

    expect(exposure).toEqual([
      { currency: 'PLN', value: 6512, share: 93 },
      { currency: 'EUR', value: 464, share: 7 },
    ]);
  });

  /** Largest first, because the card has room for a line or two and those are the ones worth it. */
  it('puts the biggest exposure first', () => {
    const exposure = currencyExposure([
      held(100, 'EUR', 'USD'),
      held(900, 'EUR', 'PLN'),
    ]);

    expect(exposure.map((one) => one.currency)).toEqual(['PLN', 'USD']);
  });

  it('adds up several holdings in the same currency', () => {
    // A second currency present on purpose: on one there is nothing to say, so a case testing the
    // summing has to give it something to say.
    const exposure = currencyExposure([
      held(300, 'EUR', 'PLN'),
      held(700, 'EUR', 'PLN'),
      held(1000, 'EUR'),
    ]);

    expect(exposure).toEqual([
      { currency: 'PLN', value: 1000, share: 50 },
      { currency: 'EUR', value: 1000, share: 50 },
    ]);
  });

  /**
   * A holding that was never converted was entered in the currency the screen reads in — so its own
   * currency is the answer, and the absence of a conversion is what says so.
   */
  it('reads an unconverted holding as being in the screen currency', () => {
    const exposure = currencyExposure([held(500, 'EUR'), held(1500, 'EUR', 'PLN')]);

    expect(exposure.find((one) => one.currency === 'EUR')).toEqual({
      currency: 'EUR',
      value: 500,
      share: 25,
    });
  });

  /**
   * Nothing at all on one currency. Saying "100% of your wealth is in złoty" to somebody who has
   * only ever held złoty is a line that repeats what the figure above it already implies, and a
   * screen that says the obvious teaches people to stop reading it.
   */
  it('says nothing where everything sits in one currency', () => {
    expect(currencyExposure([held(300, 'PLN'), held(700, 'PLN')])).toEqual([]);
  });

  it('says nothing about nothing', () => {
    expect(currencyExposure([])).toEqual([]);
  });

  /**
   * A holding worth nothing is not an exposure to anything. Left in, it would put a currency on the
   * card at nought per cent — a line saying the person is exposed to a currency they hold none of.
   */
  it('leaves out a holding worth nothing', () => {
    const exposure = currencyExposure([
      held(750, 'EUR', 'PLN'),
      held(250, 'EUR'),
      held(0, 'EUR', 'USD'),
    ]);

    expect(exposure.map((one) => one.currency)).toEqual(['PLN', 'EUR']);
    expect(exposure).toEqual([
      { currency: 'PLN', value: 750, share: 75 },
      { currency: 'EUR', value: 250, share: 25 },
    ]);
  });
});
