import { describe, it, expect } from 'vitest';
import {
  completeOnboarding,
  DEFAULT_SETTINGS,
  needsOnboarding,
  ONBOARDING_ACTION,
  withSettingsDefaults,
  type Settings,
} from '../settings.service.ts';

describe('withSettingsDefaults', () => {
  it('returns the defaults when nothing was ever stored', () => {
    expect(withSettingsDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the defaults for a null record', () => {
    expect(withSettingsDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values', () => {
    const stored: Settings = {
      currency: 'EUR',
      strategy: 'FIFTY_THIRTY_TWENTY',
      requiredActions: [],
      allocationTarget: {},
    };

    expect(withSettingsDefaults(stored)).toEqual(stored);
  });

  it('fills in only the fields a partial record is missing', () => {
    expect(withSettingsDefaults({ currency: 'USD' })).toEqual({
      currency: 'USD',
      strategy: DEFAULT_SETTINGS.strategy,
      requiredActions: DEFAULT_SETTINGS.requiredActions,
      allocationTarget: DEFAULT_SETTINGS.allocationTarget,
    });
  });

  it('treats an empty requiredActions list as meaningful, not as missing', () => {
    expect(withSettingsDefaults({ requiredActions: [] }).requiredActions).toEqual([]);
  });

  it('defaults a brand new user into onboarding', () => {
    expect(needsOnboarding(withSettingsDefaults(null))).toBe(true);
  });
});

describe('needsOnboarding', () => {
  it('is true while the onboarding action is pending', () => {
    expect(needsOnboarding({ ...DEFAULT_SETTINGS, requiredActions: [ONBOARDING_ACTION] })).toBe(
      true
    );
  });

  it('is false once nothing is pending', () => {
    expect(needsOnboarding({ ...DEFAULT_SETTINGS, requiredActions: [] })).toBe(false);
  });

  it('ignores unrelated pending actions', () => {
    expect(needsOnboarding({ ...DEFAULT_SETTINGS, requiredActions: ['verify-email'] })).toBe(false);
  });
});

describe('completeOnboarding', () => {
  it('clears the onboarding action', () => {
    const settings = { ...DEFAULT_SETTINGS, requiredActions: [ONBOARDING_ACTION] };

    expect(needsOnboarding(completeOnboarding(settings))).toBe(false);
  });

  it('leaves other pending actions alone', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      requiredActions: [ONBOARDING_ACTION, 'verify-email'],
    };

    expect(completeOnboarding(settings).requiredActions).toEqual(['verify-email']);
  });

  it('is safe to run twice', () => {
    const once = completeOnboarding({ ...DEFAULT_SETTINGS, requiredActions: [ONBOARDING_ACTION] });

    expect(completeOnboarding(once)).toEqual(once);
  });

  it('does not mutate the settings it was given', () => {
    const settings = { ...DEFAULT_SETTINGS, requiredActions: [ONBOARDING_ACTION] };

    completeOnboarding(settings);

    expect(settings.requiredActions).toEqual([ONBOARDING_ACTION]);
  });

  it('preserves currency and strategy', () => {
    const settings: Settings = {
      currency: 'EUR',
      strategy: 'EIGHTY_TWENTY',
      requiredActions: [ONBOARDING_ACTION],
      allocationTarget: {},
    };

    expect(completeOnboarding(settings)).toMatchObject({
      currency: 'EUR',
      strategy: 'EIGHTY_TWENTY',
    });
  });
});
