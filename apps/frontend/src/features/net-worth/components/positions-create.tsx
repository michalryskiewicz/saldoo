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
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { setPositionsDrawerId } from '@/store/preferences.slice.ts';
import { addDBPosition, updateDBPosition, type PositionKind } from '@/database/positions.ts';
import { checkIfOpen } from '@/lib/helpers.ts';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  kind: z.enum(['asset', 'liability']),
  value: z.number({ error: i18n.t('errors.field-required') }),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  valuedOn: z.date({ error: i18n.t('errors.field-required') }),
  /** Edited as one goal and a share; stored as the list the record carries. */
  assignedGoalId: z.string().optional(),
  assignedShare: z.number().optional(),
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

  // Today per opening rather than in module defaults: a `new Date()` there is evaluated once on
  // first import, so a tab left open across midnight would go on offering yesterday.
  const initialValues = useMemo(() => {
    const blank = {
      kind: 'asset' as const,
      currency: 'PLN',
      valuedOn: new Date(),
      ...assignmentIn(),
    };

    if (id === NEW_ENTITY_ID) return blank;

    return position ? { ...position, ...assignmentIn(position.assignments) } : blank;
  }, [id, position]);

  const handleSubmit = async (values: PositionCreateType) => {
    if (!id) return;

    const { assignedGoalId, assignedShare, ...rest } = values;
    const draft = {
      ...rest,
      kind: values.kind as PositionKind,
      assignments: assignmentsFrom(assignedGoalId, assignedShare),
    } as never;
    const saved =
      id === NEW_ENTITY_ID ? await addDBPosition(draft) : await updateDBPosition(id, draft);

    if (!saved) return;

    dispatch(setPositionsDrawerId(''));
  };

  return (
    <Sheet
      open={checkIfOpen(id, position)}
      onOpenChange={(open) => !open && dispatch(setPositionsDrawerId(''))}
    >
      <SheetContent className="xl:w-[440px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('holdings.create_title')}</SheetTitle>
          <SheetDescription>{i18n.t('holdings.create_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form initialValues={initialValues} schema={formSchema} onSubmit={handleSubmit}>
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

              <Field.Money name="value" currencyField="currency" label={i18n.t('holdings.value')} />

              {/* The date is not decoration: it is what makes the figure honest about its age. */}
              <Field.Date name="valuedOn" label={i18n.t('holdings.valued_on')} fullWidth />

              <AssignmentFields />

              <Button type="submit">{i18n.t('submit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
