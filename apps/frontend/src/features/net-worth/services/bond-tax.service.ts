import type { BondValue } from '@/features/net-worth/services/bond-accrual.service.ts';

/**
 * Where a holding sits for tax.
 *
 * `none` is an ordinary brokerage-style holding; the other two are retirement wrappers, and they
 * are taxed on entirely different principles rather than at different rates.
 */
export type TaxWrapper = 'none' | 'IKE' | 'IKZE';

/** Flat capital-gains tax, withheld by the issuer. */
export const BELKA_RATE = 0.19;

/** What a payout from an IKZE is taxed at — on the whole of it, not on the gain. */
export const IKZE_PAYOUT_RATE = 0.1;

/**
 * What somebody would actually keep if this holding came to them on the day it was valued.
 *
 * **Belka is a tax on the gain.** The capital has been taxed once already, on its way to being
 * income, so an ordinary holding hands back everything that was put in plus 81% of what it earned.
 * Interest a paying bond has already sent to an account was taxed on its way there and is not part
 * of the holding's value, so it is not taxed twice here.
 *
 * **IKE keeps the lot**, which is the whole reason to know which bonds are in one.
 *
 * **IKZE is not a cheaper Belka.** It is 10% of *everything* withdrawn, capital included — so a
 * young holding in one is worth less after tax than the money that went in, and the screen has to
 * be able to say that rather than implying a wrapper is always the better deal. What this does not
 * model is the other half of IKZE: a contribution is deducted from that year's income, which is
 * where its advantage comes from and which depends on a marginal rate this app never asks for.
 * Read the IKZE line as the pessimistic half of the bargain.
 *
 * The timing is deliberately "as if today". A compounding series is really taxed once, at
 * redemption, and that deferral is most of its advantage — which this shows, because the gross
 * line goes on compounding on money the taxman has not taken yet, and only the net line gives it
 * back at the end.
 */
export const afterTax = (value: BondValue, wrapper: TaxWrapper = 'none'): number => {
  const kept = {
    none: value.value - value.accrued * BELKA_RATE,
    IKE: value.value,
    IKZE: value.value * (1 - IKZE_PAYOUT_RATE),
  }[wrapper];

  return Number(kept.toFixed(2));
};
