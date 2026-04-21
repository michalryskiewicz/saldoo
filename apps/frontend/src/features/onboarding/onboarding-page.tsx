import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import i18n from '@/i18n.ts';
import { OnboardingCardContentSwitcher } from '@/features/onboarding/onboarding-card-content-switcher.tsx';
import FormProvider from '@/components/hook-form/form-provider.tsx';
import { useGetProfileQuery, useUpdateProfileMutation } from '@/store/profile-slice.api.ts';
import z from 'zod';
import { isStep, STEPS, STEPS_ICONS } from './onboarding-constants';
import { useNavigate } from 'react-router';
import { paths } from '@/routes/paths.ts';
import { addDBTags } from '@/database/tags.ts';

const formSchema = z.object({
  currency: z.string(),
  tags: z.array(z.string()).min(1),
  strategy: z.string(),
});

export const OnboardingPage = () => {
  // ===========================================================================
  // State
  // ===========================================================================
  const [activeTab, setActiveTab] = useState<STEPS>(STEPS.INTRODUCTION);

  // ===========================================================================
  // RTK Query
  // ===========================================================================
  const [update] = useUpdateProfileMutation();
  const { refetch } = useGetProfileQuery();
  const navigate = useNavigate();

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleOnNextStep = (step: STEPS) => {
    setActiveTab(step);
  };

  // =========================================================================
  // Return
  // =========================================================================
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start py-4 px-4 sm:justify-center sm:py-8 overflow-y-auto">
      <div className="flex w-full max-w-2xl flex-col gap-6 h-fit">
        <FormProvider
          schema={formSchema}
          onSubmit={async (values) => {
            const res = await update({ ...values, requiredActions: [] });

            if (res?.data?.data) {
              // Add tags to local database
              if (values.tags.length > 0) {
                await addDBTags(values.tags);
              }
              refetch();
              navigate(paths.dashboard.root);
            }
          }}
          initialValues={{
            tags: ['ZDROWIE', 'PODATKI', 'ŻYCIE', 'EDUKACJA', 'SUBSKRYPCJE', 'INWESTYCJE', 'SPORT'],
          }}
          // Make the form horizontally scrollable
          className="w-full overflow-x-auto"
        >
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              if (isStep(v)) setActiveTab(v);
            }}
          >
            <TabsList className="w-full flex-wrap h-auto gap-1 sm:flex-nowrap sm:h-9 sm:gap-0">
              {Object.values(STEPS).map((step) => (
                <TabsTrigger key={step} value={step} className="text-xs sm:text-sm">
                  {i18n.t(`onboarding.${step}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.values(STEPS).map((step) => {
              const Icon = STEPS_ICONS[step];
              return (
                // Keep mounted to preserve form state across tab changes
                <TabsContent key={step} value={step}>
                  <Card>
                    <CardHeader className="flex flex-row justify-center items-center w-full">
                      <Avatar className="bg-gray-100 flex justify-center items-center p-2">
                        <Icon />
                      </Avatar>
                      <CardTitle className="text-center">
                        {i18n.t(`onboarding.${step}-title`)}
                      </CardTitle>
                    </CardHeader>

                    <OnboardingCardContentSwitcher
                      step={step}
                      handleOnNextStep={handleOnNextStep}
                    />
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </FormProvider>
      </div>
    </div>
  );
};
