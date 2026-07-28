import { BUDGETING_STRATEGIES, type Currency } from '@/constant.ts';

export type BudgetingStrategy = keyof typeof BUDGETING_STRATEGIES;

export const ONBOARDING_ACTION = 'onboarding';

export type Settings = {
  currency: Currency;
  strategy: BudgetingStrategy | null;
  requiredActions: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  currency: 'PLN',
  strategy: null,
  requiredActions: [ONBOARDING_ACTION],
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
