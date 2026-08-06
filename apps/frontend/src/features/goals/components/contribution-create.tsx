import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { Field, Form } from '@/components/hook-form';
import { Button } from '@/components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import i18n from '@/i18n.ts';
import { useAppSelector } from '@/store/store.ts';
import { setContributionGoalId } from '@/store/preferences.slice.ts';
import { addDBContribution } from '@/database/contributions.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';

const formSchema = z.object({
  amount: z.number({ error: i18n.t('errors.field-required') }).positive(),
  contributedAt: z.date({ error: i18n.t('errors.field-required') }),
});

type ContributionCreateType = z.infer<typeof formSchema>;

/**
 * Saying that money went aside.
 *
 * A declaration, and in this release that is all it is — the figure grows on what the person says
 * and #98 adds what a statement can confirm beside it, never instead. A contribution with nothing
 * backing it is most often a transfer somebody meant to make and did, days before their bank got
 * round to saying so.
 */
export default function ContributionCreate() {
  const dispatch = useDispatch();
  const goalId = useAppSelector((state) => state.preferences.contributionGoalId);
  const goal = useLiveQuery(() => db.goals.get(goalId ?? ''), [goalId]);

  const close = () => dispatch(setContributionGoalId(''));

  const handleSubmit = async (values: ContributionCreateType) => {
    if (!goalId) return;

    const saved = await addDBContribution({
      goalId,
      amount: values.amount,
      contributedAt: values.contributedAt,
    });

    if (!saved) return;

    close();
  };

  return (
    <Sheet open={Boolean(goalId) && Boolean(goal)} onOpenChange={(open) => !open && close()}>
      <SheetContent className="xl:w-[440px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('goal.put_aside')}</SheetTitle>
          <SheetDescription>{goal?.description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form
            initialValues={{ contributedAt: new Date() }}
            schema={formSchema}
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-7">
              <Field.Money name="amount" currencyField="currency" label={i18n.t('goal.amount')} />
              <Field.Date name="contributedAt" label={i18n.t('goal.on_day')} fullWidth />

              <Button type="submit">{i18n.t('submit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
