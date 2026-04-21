import { CardContent, CardDescription, CardFooter } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useWatch } from 'react-hook-form';
import { Field } from '@/components/hook-form';
import i18n from '@/i18n.ts';
import { SavingsChart } from '@/features/account/components/savings-chart.tsx';
import { STEPS } from '@/features/onboarding/onboarding-constants.ts';
import { Trans } from 'react-i18next';

type OnboardingCardContentSwitcherProps = {
  step: keyof typeof STEPS;
  handleOnNextStep: (step: STEPS) => void;
};

// Small custom component that can be used inside translations
const FeatureTag: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
    {children}
  </span>
);

export const OnboardingCardContentSwitcher = ({
  step,
  handleOnNextStep,
}: OnboardingCardContentSwitcherProps) => {
  // ===========================================================================
  // Hooks
  // ===========================================================================
  const [currency, tags, strategy] = useWatch({
    name: ['currency', 'tags', 'strategy'],
  });

  // ===========================================================================
  // Render
  // ===========================================================================
  if (step === STEPS.INTRODUCTION) {
    return (
      <>
        <CardContent>
          <CardDescription>{i18n.t('onboarding.INTRODUCTION-description')}</CardDescription>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button onClick={() => handleOnNextStep(STEPS.SECURITY)}>
            {i18n.t('metrics.lets_begin')}
          </Button>
        </CardFooter>
      </>
    );
  }

  if (step === STEPS.SECURITY) {
    return (
      <>
        <CardContent>
          <CardDescription>{i18n.t('onboarding.SECURITY-description')}</CardDescription>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={() => handleOnNextStep(STEPS.SETTINGS)}>{i18n.t('metrics.next')}</Button>
        </CardFooter>
      </>
    );
  }

  if (step === STEPS.SETTINGS) {
    return (
      <>
        <CardContent>
          <CardDescription>{i18n.t('onboarding.SETTINGS-description')}</CardDescription>
        </CardContent>
        <CardContent className="grid gap-6 my-6">
          <div>
            <Field.RadioGroup
              name="currency"
              label={i18n.t('preferred_currency')}
              description={i18n.t('preferred_currency_description')}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
                { value: 'PLN', label: 'PLN' },
              ]}
            />
          </div>
          <Field.Tags
            name="tags"
            fullWidth
            label={i18n.t('metrics.add_tags')}
            description={i18n.t('metrics.add_tags_description')}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            onClick={() => handleOnNextStep(STEPS.BUDGETING_STRATEGY)}
            disabled={!currency || !tags?.length}
          >
            {i18n.t('metrics.next')}
          </Button>
        </CardFooter>
      </>
    );
  }

  if (step === STEPS.BUDGETING_STRATEGY) {
    return (
      <>
        <CardContent className="grid gap-6 my-6">
          <Field.RadioGroup
            label={i18n.t('metrics.budgeting_strategy_label')}
            name="strategy"
            options={[
              { value: 'FIFTY_THIRTY_TWENTY', label: '50-30-20' },
              { value: 'FIFTY_TWENTY_THIRTY', label: '50-20-30' },
              { value: 'SIXTY_THIRTY_TEN', label: '60-30-10' },

              { value: 'EIGHTY_TWENTY', label: '80-20' },
              { value: 'SEVENTY_TWENTY_TEN', label: '70-20-10' },

              { value: 'TEN_TEN_TEN_SEVENTY', label: '10-10-10-70' },
            ]}
          />

          <div className="h-full w-full">
            <SavingsChart />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={() => handleOnNextStep(STEPS.APP)} disabled={!strategy}>
            {i18n.t('metrics.next')}
          </Button>
        </CardFooter>
      </>
    );
  }

  if (step === STEPS.APP) {
    return (
      <>
        <CardContent>
          <CardDescription>
            <Trans
              i18nKey="onboarding.APP-description"
              components={{
                // add margin below paragraphs + relaxed line height
                p: <p className="mb-3 leading-relaxed" />,
                // indent bullets and add vertical gap between items
                ul: <ul className="list-disc pl-5 space-y-2" />,
                li: <li className="leading-relaxed" />,
                bold: <span className="font-bold" />,
                code: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" />,
                feature: <FeatureTag />,
              }}
            />
          </CardDescription>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button onClick={() => handleOnNextStep(STEPS.SUMMARY)}>Dalej</Button>
        </CardFooter>
      </>
    );
  }

  if (step === STEPS.SUMMARY) {
    return (
      <>
        <CardContent>
          <CardDescription>{i18n.t('onboarding.SUMMARY-description')}</CardDescription>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => handleOnNextStep(STEPS.INTRODUCTION)}>
            {i18n.t('metrics.from_start')}
          </Button>
          <Button type="submit" disabled={!currency || !tags?.length || !strategy}>
            {i18n.t('metrics.end')}
          </Button>
        </CardFooter>
      </>
    );
  }
};
