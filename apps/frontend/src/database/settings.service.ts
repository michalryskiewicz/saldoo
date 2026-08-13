import { BUDGETING_STRATEGIES, type Currency } from '@/constant.ts';
import type { AllocationTarget } from '@/features/net-worth/services/allocation.service.ts';

export type BudgetingStrategy = keyof typeof BUDGETING_STRATEGIES;

export const ONBOARDING_ACTION = 'onboarding';

export type Settings = {
  currency: Currency;
  strategy: BudgetingStrategy | null;
  requiredActions: string[];
  /**
   * What share of the holdings somebody meant each kind to be, as whole per cent.
   *
   * Set by hand rather than chosen from a profile. Naming three or four ready-made mixes would put the
   * app in the business of saying how somebody should invest, and it is deliberately not in it
   * (#28: no buy/sell recommendations). It reports the distance from a figure the person chose.
   *
   * Empty until somebody sets one, and an allocation reads perfectly well without it — the shares are
   * a fact either way, and only the distance needs an intention to measure against.
   */
  allocationTarget: AllocationTarget;
};

export const DEFAULT_SETTINGS: Settings = {
  currency: 'PLN',
  strategy: null,
  requiredActions: [ONBOARDING_ACTION],
  allocationTarget: {},
};

/**
 * Fills in whatever a stored settings record is missing.
 *
 * Settings travel inside the encrypted backup, so a record written by an older
 * version of the app can arrive on a newer one; every field has to survive being
 * absent.
 */
export function withSettingsDefaults(stored?: Partial<Settings> | null): Settings {
  return {
    currency: stored?.currency ?? DEFAULT_SETTINGS.currency,
    strategy: stored?.strategy ?? DEFAULT_SETTINGS.strategy,
    requiredActions: stored?.requiredActions ?? DEFAULT_SETTINGS.requiredActions,
    allocationTarget: stored?.allocationTarget ?? DEFAULT_SETTINGS.allocationTarget,
  };
}

export function needsOnboarding(settings: Settings): boolean {
  return settings.requiredActions.includes(ONBOARDING_ACTION);
}

/** Marks onboarding done without disturbing any other pending action. */
export function completeOnboarding(settings: Settings): Settings {
  return {
    ...settings,
    requiredActions: settings.requiredActions.filter((action) => action !== ONBOARDING_ACTION),
  };
}
