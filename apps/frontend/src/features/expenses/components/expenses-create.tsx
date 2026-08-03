import { Field, Form } from '@/components/hook-form';
import { FormSection } from '@/components/hook-form/form-section.tsx';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { NEW_ENTITY_ID } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { useCategories } from '@/features/hooks/use-categories.tsx';
import { useDispatch } from 'react-redux';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import { addDBExpense, updateDBExpense } from '@/database/expenses.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { checkIfOpen } from '@/lib/helpers.ts';
import { useMemo } from 'react';
import { presetFor, withResolvedCadence } from '@/lib/recurrence-presets.ts';
import { survivesIncomeLoss } from '@/lib/safety-net.ts';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  expense: z.number({ error: i18n.t('errors.field-required') }),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  severity: z.string({ error: i18n.t('errors.field-required') }),
  survivesIncomeLoss: z.enum(['yes', 'no'], { error: i18n.t('errors.field-required') }),
  cadence: z.string({ error: i18n.t('errors.field-required') }),
  frequency: z.string({ error: i18n.t('errors.field-required') }),
  interval: z.number().int().min(1).optional(),
  execution: z.date({ error: i18n.t('errors.field-required') }),
  endsAt: z.date().optional(),
  tagId: z.string({ error: i18n.t('errors.field-required') }),
  strategyPart: z.string({ error: i18n.t('errors.field-required') }),
}).refine((values) => !values.endsAt || values.endsAt >= values.execution, {
  // Silently generating nothing at all is the alternative, and a form that accepts an answer it
  // cannot honour is worse than one that refuses it.
  error: i18n.t('errors.ends-before-it-starts'),
  path: ['endsAt'],
});

export type ExpenseCreateType = z.infer<typeof formSchema>;

const defaultValues = {
  currency: 'PLN',
  severity: 'MEDIUM',
  survivesIncomeLoss: 'yes',
  cadence: 'WEEKLY',
  frequency: 'WEEKLY',
  interval: 1,
  tags: [],
};

export default function ExpensesCreate() {
  const dispatch = useDispatch();

  const { budgetingPartsOptions, tags } = useCategories();

  const id = useAppSelector((state) => state.preferences.expensesDrawerId);
  const expense = useLiveQuery(() => db.expenses.get(id ?? ''), [id]);

  // Today by default, computed per opening rather than in the module's own defaults: a `new Date()`
  // there is evaluated once on first import, so a tab left open across midnight would go on
  // offering yesterday.
  //
  // The strategy part defaults to the first the chosen strategy offers, rather than to a named one:
  // which parts exist depends on the strategy, and "80-20" has no `NEEDS` at all — a hardcoded
  // default would be a value its own select could not show. Without any default the field was
  // required and empty, so every new expense had to answer it by hand.
  const initialValues = useMemo(
    () =>
      id === NEW_ENTITY_ID
        ? {
            ...defaultValues,
            execution: new Date(),
            strategyPart: budgetingPartsOptions[0]?.value,
          }
        : expense
          ? {
              ...expense,
              cadence: presetFor(expense),
              // Asked as a word because the control deals in words. A cost that has never been
              // asked arrives showing what it is already counted as, so opening the drawer and
              // saving is how an old cost gets an answer of its own.
              survivesIncomeLoss: survivesIncomeLoss(expense) ? 'yes' : 'no',
            }
          : defaultValues,
    [budgetingPartsOptions, expense, id]
  );

  const handleSubmit = async (values: ExpenseCreateType) => {
    if (!id) return;

    const cost = withResolvedCadence(values);

    const saved =
      id === NEW_ENTITY_ID ? await addDBExpense(cost) : await updateDBExpense(id, cost);

    // Staying open is the point: a drawer that shuts either way is why a failed save was
    // indistinguishable from a successful one, and the toast alone was easy to miss.
    if (!saved) return;

    return dispatch(setExpensesDrawerId(''));
  };

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <Sheet
      open={checkIfOpen(id, expense)}
      onOpenChange={(value) => {
        if (!value) {
          dispatch(setExpensesDrawerId(''));
        }
      }}
    >
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('create_expense_title')}</SheetTitle>
          <SheetDescription>{i18n.t('create_expense_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form
            //eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            initialValues={initialValues}
            schema={formSchema}
            onSubmit={handleSubmit}
            //eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            resetFields={!expense && { description: '', expense: undefined }}
          >
            {/* Grouped by the question each field answers. Seven fields in one run put "what am I
                buying" exactly as close to "which budget-strategy category is this" as to "how
                much", and those are not the same question. */}
            <div className="flex flex-col gap-7">
              <FormSection title={i18n.t('form_sections.what')}>
                <Field.Text name="description" label={i18n.t('description')} />

                <Field.Money name="expense" currencyField="currency" label={i18n.t('expense')} />

                <Field.Segmented
                  name="severity"
                  label={i18n.t('severity')}
                  options={[
                    { label: i18n.t('LOW'), value: 'LOW', color: 'var(--severity-low-fill)' },
                    {
                      label: i18n.t('MEDIUM'),
                      value: 'MEDIUM',
                      color: 'var(--severity-medium-fill)',
                    },
                    { label: i18n.t('HIGH'), value: 'HIGH', color: 'var(--severity-high-fill)' },
                  ]}
                />

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

              <FormSection title={i18n.t('form_sections.classify')}>
                <Field.AutoComplete
                  name="tagId"
                  label={i18n.t('forms.category')}
                  fullWidth
                  helperText={i18n.t('forms.category-helper-text')}
                  placeholder={i18n.t('forms.category-placeholder')}
                  options={tags}
                />

                <Field.Segmented
                  name="strategyPart"
                  label={i18n.t('forms.strategy-part')}
                  helperText={i18n.t('forms.strategy-part-tooltip')}
                  options={budgetingPartsOptions}
                />

                <Field.Segmented
                  name="survivesIncomeLoss"
                  label={i18n.t('cost_nature.question')}
                  helperText={i18n.t('cost_nature.helper')}
                  options={[
                    { label: i18n.t('cost_nature.irreducible'), value: 'yes' },
                    { label: i18n.t('cost_nature.reducible'), value: 'no' },
                  ]}
                />
              </FormSection>

              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
