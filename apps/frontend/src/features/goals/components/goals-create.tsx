import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { Field, Form } from '@/components/hook-form';
import { FormSection } from '@/components/hook-form/form-section.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { NEW_ENTITY_ID, type STRATEGY_PART } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { useCategories } from '@/features/hooks/use-categories.tsx';
import { useAppSelector } from '@/store/store.ts';
import { setGoalsDrawerId } from '@/store/preferences.slice.ts';
import { addDBGoal, type CoverageMonths } from '@/database/goals.ts';
import { useGoals } from '@/features/goals/hooks/use-goals.tsx';

const formSchema = z
  .object({
    kind: z.enum(['goal', 'fund']),
    description: z.string().optional(),
    target: z.number().optional(),
    deadline: z.date().optional(),
    coverageMonths: z.enum(['3', '6', '12']).optional(),
    monthlyPace: z.number().optional(),
    rollsYearly: z.enum(['yes', 'no']),
    keepsItsMoney: z.enum(['yes', 'no']),
    strategyPart: z.string({ error: i18n.t('errors.field-required') }),
  })
  // Each kind needs what the other has no use for, so the requirement is stated per kind rather
  // than on the field: required everywhere would refuse every form, required nowhere would accept
  // a goal with no target.
  .refine((values) => values.kind !== 'goal' || (values.description ?? '').trim().length >= 2, {
    error: i18n.t('errors.min-2-length-required'),
    path: ['description'],
  })
  .refine((values) => values.kind !== 'goal' || (values.target ?? 0) > 0, {
    error: i18n.t('errors.field-required'),
    path: ['target'],
  })
  .refine((values) => values.kind !== 'goal' || Boolean(values.deadline), {
    error: i18n.t('errors.field-required'),
    path: ['deadline'],
  })
  .refine((values) => values.kind !== 'fund' || (values.monthlyPace ?? 0) > 0, {
    error: i18n.t('errors.field-required'),
    path: ['monthlyPace'],
  });

export type GoalCreateType = z.infer<typeof formSchema>;

/**
 * The fields that depend on which kind is being made.
 *
 * A child component, and that is not a preference: `Form` takes its children as a **prop**, so
 * they are built in the parent's render, outside the provider, where `watch()` reads a value once
 * and never changes and a conditional field never appears.
 */
const KindFields = () => {
  const kind = useWatch({ name: 'kind' });

  if (kind === 'fund') {
    return (
      <>
        <Field.Segmented
          name="coverageMonths"
          label={i18n.t('goals.coverage')}
          helperText={i18n.t('goals.coverage-helper')}
          options={[
            { label: i18n.t('goals.months_3'), value: '3' },
            { label: i18n.t('goals.months_6'), value: '6' },
            { label: i18n.t('goals.months_12'), value: '12' },
          ]}
        />

        {/* A pace where the others have a date. The fund has no deadline, so it is given a rate
            and told when that rate gets there. */}
        <Field.Money
          name="monthlyPace"
          currencyField="currency"
          label={i18n.t('goals.monthly_pace')}
        />
      </>
    );
  }

  return (
    <>
      <Field.Text name="description" label={i18n.t('description')} />
      <Field.Money name="target" currencyField="currency" label={i18n.t('goals.target')} />
      <Field.Date name="deadline" label={i18n.t('goals.deadline')} fullWidth />

      <Field.Segmented
        name="rollsYearly"
        label={i18n.t('goals.rolls_yearly')}
        helperText={i18n.t('goals.rolls_yearly-helper')}
        options={[
          { label: i18n.t('goals.rolls_no'), value: 'no' },
          { label: i18n.t('goals.rolls_yes'), value: 'yes' },
        ]}
      />

      <Field.Segmented
        name="keepsItsMoney"
        label={i18n.t('goals.keeps_its_money')}
        helperText={i18n.t('goals.keeps_its_money-helper')}
        options={[
          { label: i18n.t('goals.spent'), value: 'no' },
          { label: i18n.t('goals.kept'), value: 'yes' },
        ]}
      />
    </>
  );
};

export default function GoalsCreate() {
  const dispatch = useDispatch();
  const { budgetingPartsOptions } = useCategories();
  const { hasEmergencyFund } = useGoals();

  const id = useAppSelector((state) => state.preferences.goalsDrawerId);

  const initialValues = useMemo(
    () => ({
      kind: 'goal' as const,
      rollsYearly: 'no' as const,
      keepsItsMoney: 'no' as const,
      coverageMonths: '3' as const,
      strategyPart: budgetingPartsOptions[0]?.value,
    }),
    [budgetingPartsOptions]
  );

  const handleSubmit = async (values: GoalCreateType) => {
    const thisYear = new Date().getFullYear();
    const isFund = values.kind === 'fund';

    const saved = await addDBGoal({
      description: isFund ? i18n.t('goals.emergency_fund') : (values.description as string),
      strategyPart: values.strategyPart as STRATEGY_PART,
      // A fund is kept by definition: it is not spent on anything, it is what stands between the
      // person and having to.
      keepsItsMoney: isFund || values.keepsItsMoney === 'yes',
      ...(isFund
        ? {
            coverageMonths: Number(values.coverageMonths) as CoverageMonths,
            monthlyPace: values.monthlyPace,
          }
        : {
            target: values.target,
            deadline: values.deadline,
            ...(values.rollsYearly === 'yes' ? { year: thisYear } : {}),
          }),
    });

    if (!saved) return;

    dispatch(setGoalsDrawerId(''));
  };

  return (
    <Sheet open={id === NEW_ENTITY_ID} onOpenChange={(open) => !open && dispatch(setGoalsDrawerId(''))}>
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('goals.create_title')}</SheetTitle>
          <SheetDescription>{i18n.t('goals.create_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form initialValues={initialValues} schema={formSchema} onSubmit={handleSubmit}>
            <div className="flex flex-col gap-7">
              <FormSection title={i18n.t('goals.what_for')}>
                {/* Offered only while there is no fund. A second safety net is not a thing. */}
                {!hasEmergencyFund && (
                  <Field.Segmented
                    name="kind"
                    label={i18n.t('goals.kind')}
                    options={[
                      { label: i18n.t('goals.kind_goal'), value: 'goal' },
                      { label: i18n.t('goals.kind_fund'), value: 'fund' },
                    ]}
                  />
                )}

                <KindFields />
              </FormSection>

              <FormSection title={i18n.t('form_sections.classify')}>
                <Field.Segmented
                  name="strategyPart"
                  label={i18n.t('forms.strategy-part')}
                  helperText={i18n.t('goals.strategy-part-helper')}
                  options={budgetingPartsOptions}
                />
              </FormSection>

              <Button type="submit">{i18n.t('submit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
