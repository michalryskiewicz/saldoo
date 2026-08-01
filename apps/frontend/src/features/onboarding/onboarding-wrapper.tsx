import type { PropsWithChildren } from 'react';
import { OnboardingPage } from '@/features/onboarding/onboarding-page.tsx';
import { AppLoading } from '@/components/loaders/app-loading.tsx';
import { useSettings } from '@/features/settings/use-settings.ts';
import { needsOnboarding } from '@/database/settings.service.ts';

export const OnboardingWrapper = ({ children }: PropsWithChildren) => {
  const { settings, isLoading } = useSettings();

  // ===========================================================================
  // Return
  // ===========================================================================
  if (isLoading || !settings) {
    return <AppLoading />;
  }

  if (needsOnboarding(settings)) {
    return <OnboardingPage />;
  }

  return children;
};
