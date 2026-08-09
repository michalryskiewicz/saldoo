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
import { defaultStrategyPart } from '@/features/goals/services/default-strategy-part.service.ts';
import { useCategories } from '@/features/hooks/use-categories.tsx';
import { useAppSelector } from '@/store/store.ts';
import { setGoalsDrawerId } from '@/store/preferences.slice.ts';
import { addDBGoal, type CoverageMonths } from '@/database/goals.ts';
import { useGoals } from '@/features/goals/hooks/use-goals.tsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { updateDBExpense } from '@/database/expenses.ts';
import { setConvertingExpenseId } from '@/store/preferences.slice.ts';
import {
  goalDraftFromExpense,
  lastDayItIsStillACost,
} from '@/features/goals/services/expense-to-goal.service.ts';
import { presetFor } from '@/lib/recurrence-presets.ts';

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
    funding: z.enum(['contributions', 'holdings']),
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
          label={i18n.t('goal.coverage')}
          helperText={i18n.t('goal.coverage-helper')}
          options={[
            { label: i18n.t('goal.months_3'), value: '3' },
            { label: i18n.t('goal.months_6'), value: '6' },
            { label: i18n.t('goal.months_12'), value: '12' },
          ]}
        />

        {/* A pace where the others have a date. The fund has no deadline, so it is given a rate
            and told when that rate gets there. */}
        <Field.Money
          name="monthlyPace"
          currencyField="currency"
          label={i18n.t('goal.monthly_pace')}
        />
      </>
    );
  }

  return (
    <>
      <Field.Text name="description" label={i18n.t('description')} />
      <Field.Money name="target" currencyField="currency" label={i18n.t('goal.target')} />
      <Field.Date name="deadline" label={i18n.t('goal.deadline')} fullWidth />

      <Field.Segmented
        name="rollsYearly"
        label={i18n.t('goal.rolls_yearly')}
        helperText={i18n.t('goal.rolls_yearly-helper')}
        options={[
          { label: i18n.t('goal.rolls_no'), value: 'no' },
          { label: i18n.t('goal.rolls_yes'), value: 'yes' },
        ]}
      />

      <Field.Segmented
        name="keepsItsMoney"
        label={i18n.t('goal.keeps_its_money')}
        helperText={i18n.t('goal.keeps_its_money-helper')}
        options={[
          { label: i18n.t('goal.spent'), value: 'no' },
          { label: i18n.t('goal.kept'), value: 'yes' },
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

  // The cost this goal is replacing, when the drawer was opened from the expenses table.
  const convertingId = useAppSelector((state) => state.preferences.convertingExpenseId);
  const replacing = useLiveQuery(() => db.expenses.get(convertingId ?? ''), [convertingId]);
  const profits = useLiveQuery(() => db.profits.toArray(), []) || [];

  const initialValues = useMemo(() => {
    const blank = {
      kind: 'goal' as const,
      rollsYearly: 'no' as const,
      keepsItsMoney: 'no' as const,
      coverageMonths: '3' as const,
      strategyPart: defaultStrategyPart(budgetingPartsOptions),
      funding: 'contributions' as const,
    };

    if (!replacing) return blank;

    // Everything the cost already knows, and nothing it does not: `keepsItsMoney` stays at its
    // default for the person to answer, because that field decides what the lifetime figure means.
    const draft = goalDraftFromExpense(replacing, profits, new Date());

    return {
      ...blank,
      description: draft.description,
      target: draft.target,
      deadline: draft.deadline,
      rollsYearly: 'yes' as const,
      strategyPart: draft.strategyPart ?? blank.strategyPart,
      funding: blank.funding,
    };
  }, [budgetingPartsOptions, replacing, profits]);

  const handleSubmit = async (values: GoalCreateType) => {
    const thisYear = new Date().getFullYear();
    const isFund = values.kind === 'fund';

    const saved = await addDBGoal({
      description: isFund ? i18n.t('goal.emergency_fund') : (values.description as string),
      strategyPart: values.strategyPart as STRATEGY_PART,
      funding: values.funding,
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

    // The cost stops at the end of this month, and only once the goal exists. Ending a series is
    // not deleting it (#70), so every occurrence up to that day keeps its marks — and the strategy
    // tile stays continuous across the boundary, the old months answered by the expense and the
    // new ones by the goal.
    if (replacing) {
      await updateDBExpense(replacing.id, {
        ...replacing,
        cadence: presetFor(replacing),
        amountMode: replacing.percentageOfIncome ? 'share' : 'fixed',
        percent: replacing.percentageOfIncome?.percent,
        profitIds: replacing.percentageOfIncome?.profitIds,
        basePeriod: replacing.percentageOfIncome?.basePeriod,
        survivesIncomeLoss: replacing.survivesIncomeLoss === false ? 'no' : 'yes',
        endsAt: lastDayItIsStillACost(new Date()),
      } as never);

      dispatch(setConvertingExpenseId(''));
    }

    dispatch(setGoalsDrawerId(''));
  };

  return (
    // Held shut until the cost being replaced has loaded. `useForm` reads its defaults once, when
    // it mounts, so a drawer that opens before the live query answers keeps the empty values it
    // mounted with and no later value is ever seen — the same trap as `watch()` reading a field
    // once. `ExpensesCreate` gates on exactly this for exactly this reason.
    <Sheet
      open={id === NEW_ENTITY_ID && (!convertingId || Boolean(replacing))}
      onOpenChange={(open) => {
        if (open) return;
        dispatch(setGoalsDrawerId(''));
        dispatch(setConvertingExpenseId(''));
      }}>
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('goal.create_title')}</SheetTitle>
          <SheetDescription>{i18n.t('goal.create_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form initialValues={initialValues} schema={formSchema} onSubmit={handleSubmit}>
            <div className="flex flex-col gap-7">
              <FormSection title={i18n.t('goal.what_for')}>
                {/* Offered only while there is no fund. A second safety net is not a thing. */}
                {!hasEmergencyFund && (
                  <Field.Segmented
                    name="kind"
                    label={i18n.t('goal.kind')}
                    options={[
                      { label: i18n.t('goal.kind_goal'), value: 'goal' },
                      { label: i18n.t('goal.kind_fund'), value: 'fund' },
                    ]}
                  />
                )}

                <KindFields />
              </FormSection>

              <FormSection title={i18n.t('form_sections.classify')}>
                <Field.Segmented
                  name="strategyPart"
                  label={i18n.t('forms.strategy-part')}
                  helperText={i18n.t('goal.strategy-part-helper')}
                  options={budgetingPartsOptions}
                />

                {/* One or the other, never both: a declaration and the account the money landed in
                    are the same złoty seen twice. */}
                <Field.Segmented
                  name="funding"
                  label={i18n.t('goal.funding')}
                  helperText={i18n.t('goal.funding-helper')}
                  options={[
                    { label: i18n.t('goal.funding_contributions'), value: 'contributions' },
                    { label: i18n.t('goal.funding_holdings'), value: 'holdings' },
                  ]}
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
