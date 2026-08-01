import i18n from '@/i18n.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { Field, Form } from '@/components/hook-form';
import { FormSection } from '@/components/hook-form/form-section.tsx';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '@/store/store.ts';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { addDBProfit, updateDBProfit } from '@/database/profits.ts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';
import { checkIfOpen } from '@/lib/helpers';
import { presetFor, withResolvedCadence } from '@/lib/recurrence-presets.ts';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  profit: z.number({ error: i18n.t('errors.field-required') }),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  cadence: z.string({ error: i18n.t('errors.field-required') }),
  frequency: z.string({ error: i18n.t('errors.field-required') }),
  interval: z.number().int().min(1).optional(),
  execution: z.date({ error: i18n.t('errors.field-required') }),
  endsAt: z.date().optional(),
}).refine((values) => !values.endsAt || values.endsAt >= values.execution, {
  error: i18n.t('errors.ends-before-it-starts'),
  path: ['endsAt'],
});

export type ProfitCreateSchema = z.infer<typeof formSchema>;

// Monthly, because income mostly is. Left unset the field was required and empty, so every
// profit had to answer it by hand before the form would submit at all.
const defaultValues = {
  currency: 'PLN',
  cadence: 'MONTHLY',
  frequency: 'MONTHLY',
  interval: 1,
};

export default function ProfitsCreatePage() {
  const dispatch = useDispatch();

  const id = useAppSelector((state) => state.preferences.profitsDrawerId);
  const profit = useLiveQuery(() => db.profits.get(id ?? ''), [id]);

  // Today by default, computed per opening rather than in the module's own defaults: a `new Date()`
  // there is evaluated once on first import, so a tab left open across midnight would go on
  // offering yesterday.
  const initialValues = useMemo(
    () => (id === NEW_ENTITY_ID
        ? { ...defaultValues, execution: new Date() }
        : profit
          ? { ...profit, cadence: presetFor(profit) }
          : defaultValues),
    [profit, id]
  );

  const handleSubmit = async (values: ProfitCreateSchema): Promise<void> => {
    if (!id) return;

    const income = withResolvedCadence(values);

    const saved =
      id === NEW_ENTITY_ID ? await addDBProfit(income) : await updateDBProfit(id, income);
    if (!saved) return;

    dispatch(serProfitsDrawerId(''));
  };

  return (
    <Sheet
      open={checkIfOpen(id, profit)}
      onOpenChange={(value) => {
        if (!value) {
          dispatch(serProfitsDrawerId(''));
        }
      }}
    >
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('create_profits_title')}</SheetTitle>
          <SheetDescription>{i18n.t('create_profits_description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-1.5 p-4">
          <Form
            initialValues={initialValues}
            schema={formSchema}
            onSubmit={handleSubmit}
            // Cleared for the next one, keeping the answers that are likely to repeat: the
            // drawer stays mounted, so without this it reopens holding the last profit's name
            // and amount.
            resetFields={profit ? undefined : { description: '', profit: undefined }}
          >
            {/* Grouped by the question each field answers, the way the expenses form is. There
                are only two questions here — a profit has no priority and nothing to classify it
                by — but "what and how much" and "when" are still not one decision. */}
            <div className="flex flex-col gap-7">
              <FormSection title={i18n.t('form_sections.what')}>
                <Field.Text name="description" label={i18n.t('description')} />

                <Field.Money name="profit" currencyField="currency" label={i18n.t('profit')} />
              </FormSection>

              <FormSection title={i18n.t('form_sections.when')}>
                {/* One question, asked the way it is said: "co kwartał" rather than a unit and a
                    step the reader has to multiply together. */}
                <Field.Cadence />

                {/* The dates are a pair — when it starts and when it stops — so they stand
                    beside each other rather than one under the cadence and one adrift. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field.Date
                    name="execution"
                    label={i18n.t('forms.first-execution')}
                    fullWidth
                    placeholder={i18n.t('execution_placeholder')}
                  />
                  <Field.Date
                    name="endsAt"
                    label={i18n.t('forms.ends-at')}
                    fullWidth
                    placeholder={i18n.t('forms.ends-at-placeholder')}
                  />
                </div>
              </FormSection>

              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
