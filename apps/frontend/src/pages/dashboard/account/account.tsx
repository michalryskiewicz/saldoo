import { Button } from '@/components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { Field, Form } from '@/components/hook-form';
import i18n from '@/i18n.ts';
import { z } from 'zod';
import { useSettings } from '@/features/settings/use-settings.ts';
import { saveSettings } from '@/database/settings.ts';
import type { BudgetingStrategy } from '@/database/settings.service.ts';
import type { Currency } from '@/constant.ts';
import { ContentSkeleton } from '@/components/loaders/content-skeleton.tsx';
import { SavingsChart } from '@/features/account/components/savings-chart.tsx';
import { addDBTags, removeDBTags } from '@/database/tags.ts';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';
import { toast } from 'sonner';
import { MadeByCredit } from '@/components/made-by-credit.tsx';
import { AllocationTargetFields } from '@/features/net-worth/components/allocation-target-fields.tsx';
import {
  isTargetUsable,
  onlyChosenShares,
} from '@/features/net-worth/services/allocation.service.ts';

const formSchema = z
  .object({
    currency: z.string(),
    strategy: z.string(),
    tags: z.array(z.string()),
    /** Per kind, as whole per cent. Blank rows are kinds nobody aimed at, not zeroes. */
    allocationTarget: z.record(z.string(), z.number().min(0).max(100).optional()),
  })
  // Shares of something are not shares of it unless they come to all of it. Nothing set at all is
  // equally valid and means nobody has chosen a target — the allocation reads fine without one.
  .refine((values) => isTargetUsable(values.allocationTarget), {
    path: ['allocationTarget'],
    message: i18n.t('holdings.allocation.target_helper'),
  });

type UpdateProfileForm = z.infer<typeof formSchema>;

export default function Account() {
  const { settings, isLoading } = useSettings();
  const { tagsNames, isLoading: areTagsLoading } = useListTags();

  const onSubmit = async (values: UpdateProfileForm): Promise<void> => {
    // The tag mutators announce themselves, so this covers only the settings. Without it a
    // person who changed nothing but the strategy got no word either way, which reads as the
    // screen not working rather than as a save that happened quietly.
    try {
      await saveSettings({
        currency: values.currency as Currency,
        strategy: values.strategy as BudgetingStrategy,
        allocationTarget: onlyChosenShares(values.allocationTarget),
      });
      toast(i18n.t('success.update-account-settings'));
    } catch (error) {
      // React Hook Form swallows whatever a submit handler throws, so an unreported failure
      // here is indistinguishable from a success.
      console.error(error);
      toast(i18n.t('errors.update-account-settings'));
      return;
    }

    const originalTags = tagsNames ?? [];
    const newTags = values.tags;

    const addedTags = newTags.filter((tag) => !originalTags.includes(tag));
    const removedTags = originalTags.filter((tag) => !newTags.includes(tag));

    if (addedTags.length > 0) {
      await addDBTags(addedTags);
    }

    if (removedTags.length > 0) {
      await removeDBTags(removedTags);
    }
  };

  if (isLoading || areTagsLoading) {
    return <ContentSkeleton />;
  }

  return (
    <>
      <div className="flex flex-col w-full h-full">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight p-4">
          {i18n.t('settings')}
        </h3>
        <div className="flex flex-col md:flex-row w-full h-full">
          <div className="flex flex-col gap-4 pt-4 w-1/8 items-center">
            <Button variant="link" className="hover:cursor-pointer">
              {i18n.t('account')}
            </Button>
          </div>

          <div className="h-full w-full p-4 ">
            <Form
              schema={formSchema}
              initialValues={{
                currency: settings?.currency,
                strategy: settings?.strategy ?? undefined,
                tags: tagsNames,
                allocationTarget: settings?.allocationTarget ?? {},
              }}
              onSubmit={onSubmit}
            >
              <div className="gap-4 flex flex-col ml-auto mr-auto w-full max-w-4xl">
                <Card className="w-full">
                  <CardHeader className="border-b">
                    <CardTitle>{i18n.t('account_settings')}</CardTitle>
                    <CardDescription>{i18n.t('account_settings_description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>

                <Card className="w-full">
                  <CardHeader className="border-b">
                    <CardTitle>Kategorie wydatkow</CardTitle>
                    <CardDescription>
                      Poniżej zmodyfikuj kategorie wydatków, kilka z nich dodaliśmy domyślnie dla
                      Ciebie. Możesz je uzupełnić o własne kryteria
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Field.Tags name="tags" fullWidth label={'Dodaj etykiety'} />
                    <div className="h-full w-full"></div>
                  </CardContent>
                </Card>

                <Card className="w-full">
                  <CardHeader className="border-b">
                    <CardTitle>{i18n.t('holdings.allocation.target_title')}</CardTitle>
                    <CardDescription>
                      {i18n.t('holdings.allocation.target_helper')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AllocationTargetFields />
                  </CardContent>
                </Card>

                <Card className=" w-full">
                  <CardHeader className="border-b">
                    <CardTitle>Oczekiwana strategia wydatków</CardTitle>
                    <CardDescription>
                      Poniżej wybierz interesującą Cię strategię dotyczącą twoich wydatków
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Field.RadioGroup
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
                </Card>

                <Button className="mt-6 ml-auto">{i18n.t('submit')}</Button>
              </div>
            </Form>

            <div className="mt-8 flex justify-center border-t pt-6">
              <MadeByCredit />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
