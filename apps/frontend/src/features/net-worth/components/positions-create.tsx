import { z } from 'zod';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Field, Form } from '@/components/hook-form';
import { Button } from '@/components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { NEW_ENTITY_ID } from '@/constant.ts';
import i18n from '@/i18n.ts';
import {
  AssignmentFields,
  UNASSIGNED,
} from '@/features/net-worth/components/assignment-fields.tsx';
import { AssetTypeFields } from '@/features/net-worth/components/asset-type-fields.tsx';
import {
  assetTypeFrom,
  isPricedPerUnit,
  worthFromUnits,
} from '@/features/net-worth/services/unit-priced-worth.service.ts';
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { setPositionFromGoalId, setPositionsDrawerId } from '@/store/preferences.slice.ts';
import { addDBPosition, updateDBPosition, type PositionKind } from '@/database/positions.ts';
import { switchDBGoalsToHoldings } from '@/database/goals.ts';
import { goalsNowReadingHoldings } from '@/features/goals/services/goal-backing.service.ts';
import { checkIfOpen } from '@/lib/helpers.ts';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  kind: z.enum(['asset', 'liability']),
  /**
   * Optional here and required by the rule below, because which figure a holding needs depends on
   * what kind it is: a counted one has no total to type, and asking for it anyway would refuse to
   * save an ETF that has been filled in perfectly.
   */
  value: z.number().optional(),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  valuedOn: z.date({ error: i18n.t('errors.field-required') }),
  boughtOn: z.date().optional(),
  /** Stored as the enum, or left off entirely — `UNTYPED` is only how the form spells "not said". */
  assetType: z.string().optional(),
  units: z.number().optional(),
  unitPrice: z.number().optional(),
  /** Edited as one goal and a share; stored as the list the record carries. */
  assignedGoalId: z.string().optional(),
  assignedShare: z.number().optional(),
});

/**
 * A holding is worth what somebody typed, or what its count and price come to — one of the two, and
 * which one follows from its kind. Enforced here rather than on the fields, because neither field is
 * required on its own: it depends on the answer to another question.
 */
const positionSchema = formSchema.superRefine((values, context) => {
  if (isPricedPerUnit(assetTypeFrom(values.assetType))) {
    for (const field of ['units', 'unitPrice'] as const) {
      if (values[field] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: i18n.t('errors.field-required'),
        });
      }
    }

    return;
  }

  if (values.value === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: i18n.t('errors.field-required'),
    });
  }
});

type PositionCreateType = z.infer<typeof formSchema>;


/** The list the record carries, from the one goal and share the form edits. */
const assignmentsFrom = (goalId?: string, share?: number) =>
  goalId && goalId !== UNASSIGNED
    ? [{ goalId, share: Math.min(100, Math.max(0, share ?? 100)) }]
    : [];

/** And back again, for the form to open on what is already there. */
const assignmentIn = (assignments?: { goalId: string; share: number }[]) => ({
  assignedGoalId: assignments?.[0]?.goalId ?? UNASSIGNED,
  assignedShare: assignments?.[0]?.share ?? 100,
});

export default function PositionsCreate() {
  const dispatch = useDispatch();
  const id = useAppSelector((state) => state.preferences.positionsDrawerId);
  const position = useLiveQuery(() => db.positions.get(id ?? ''), [id]);

  // Every goal, so the save can tell which of them a holding has just been pointed at.
  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];

  // The goal this was opened from, when it was opened from one.
  const fromGoalId = useAppSelector((state) => state.preferences.positionFromGoalId);
  const goal = useLiveQuery(() => db.goals.get(fromGoalId ?? ''), [fromGoalId]);
  const putAside = useLiveQuery(
    async () =>
      fromGoalId
        ? (await db.contributions.where('goalId').equals(fromGoalId).toArray()).reduce(
            (total, contribution) => total + contribution.amount,
            0
          )
        : 0,
    [fromGoalId]
  );

  // Today per opening rather than in module defaults: a `new Date()` there is evaluated once on
  // first import, so a tab left open across midnight would go on offering yesterday.
  const initialValues = useMemo(() => {
    const blank = {
      kind: 'asset' as const,
      currency: 'PLN',
      valuedOn: new Date(),
      ...assignmentIn(),
    };

    if (id !== NEW_ENTITY_ID) {
      return position ? { ...position, ...assignmentIn(position.assignments) } : blank;
    }

    // Opened from a goal: its name and what has gone in, as a starting point and nothing more.
    // The value stays editable on purpose — what was declared and what the holding is worth are
    // different numbers, and for anything invested they differ by the returns. Filling it in
    // silently would be the app making that guess on somebody's behalf.
    //
    // Pointed at that goal, and at the whole of it: arriving from a goal's own card is as plain a
    // statement of what the holding is for as anybody is going to make.
    if (goal) {
      return {
        ...blank,
        description: goal.description,
        currency: goal.currency,
        value: putAside,
        assignedGoalId: goal.id,
        assignedShare: 100,
      };
    }

    return blank;
  }, [id, position, goal, putAside]);

  const close = () => {
    dispatch(setPositionsDrawerId(''));
    // Or the next holding somebody adds by hand arrives wearing this goal's name.
    dispatch(setPositionFromGoalId(''));
  };

  const handleSubmit = async (values: PositionCreateType) => {
    if (!id) return;

    const { assignedGoalId, assignedShare, ...rest } = values;
    const assignments = assignmentsFrom(assignedGoalId, assignedShare);
    const assetType = assetTypeFrom(values.assetType);

    // One stored worth, whichever way it was arrived at. For a counted holding the count and the
    // price are what the person knows and the multiplication is not theirs to do; for everything else
    // the figure they typed stands.
    const fromUnits = isPricedPerUnit(assetType)
      ? worthFromUnits({ units: values.units, unitPrice: values.unitPrice })
      : undefined;

    const draft = {
      ...rest,
      assetType,
      kind: values.kind as PositionKind,
      value: fromUnits ?? values.value,
      assignments,
    } as never;
    const saved =
      id === NEW_ENTITY_ID ? await addDBPosition(draft) : await updateDBPosition(id, draft);

    if (!saved) return;

    // After the holding is stored, never before: a goal switched over to a holding that failed to
    // save would read nothing at all.
    await switchDBGoalsToHoldings(goalsNowReadingHoldings(assignments, goals));

    close();
  };

  return (
    <Sheet open={checkIfOpen(id, position)} onOpenChange={(open) => !open && close()}>
      <SheetContent className="xl:w-[440px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('holdings.create_title')}</SheetTitle>
          <SheetDescription>{i18n.t('holdings.create_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          {/* Keyed on the goal it was opened from, because `initialValues` are read once when the
              form mounts. Opened from a goal, the drawer is up before Dexie has answered, and
              without a remount the fields it was meant to arrive prefilled with stay empty for as
              long as it is open. */}
          <Form
            key={goal?.id ?? id}
            initialValues={initialValues}
            schema={positionSchema}
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-7">
              <Field.Text name="description" label={i18n.t('holdings.what')} />

              <Field.Segmented
                name="kind"
                label={i18n.t('holdings.kind')}
                options={[
                  { label: i18n.t('holdings.asset'), value: 'asset' },
                  { label: i18n.t('holdings.liability'), value: 'liability' },
                ]}
              />

              <AssetTypeFields />

              {/* The date is not decoration: it is what makes the figure honest about its age. */}
              <Field.Date name="valuedOn" label={i18n.t('holdings.valued_on')} fullWidth />

              {/* A different question from the one above, and neither substitutes for the other: when
                  the money went out, against what the thing is worth now. The gap between them is the
                  only place a return over the whole holding can come from. */}
              <Field.Date
                name="boughtOn"
                label={i18n.t('holdings.bought_on')}
                helperText={i18n.t('holdings.bought_on_helper')}
                fullWidth
              />

              <AssignmentFields />

              <Button type="submit">{i18n.t('submit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
