import { useLiveQuery } from 'dexie-react-hooks';
import { useWatch } from 'react-hook-form';
import { Field } from '@/components/hook-form';
import { db } from '@/database';
import i18n from '@/i18n.ts';

/**
 * What "for nothing in particular" is stored as while the form is open.
 *
 * Not an empty string: a Radix select item may not carry one — it throws rather than rendering, and
 * a throw inside a drawer takes the whole page down with it.
 */
export const UNASSIGNED = 'none';

/**
 * What a holding is for, asked where the holding is edited.
 *
 * **One goal per holding here, though the record holds a list.** Splitting an account between a
 * fund and a holiday is real and the model carries it; a form for editing a list of shares is a
 * different piece of work, and shipping it before anybody has assigned anything once would be
 * building the second thing first.
 *
 * The share defaults to the whole of it, because that is what somebody means the first time they
 * say an account *is* their emergency fund.
 */
export const AssignmentFields = () => {
  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];
  const goalId = useWatch({ name: 'assignedGoalId' }) as string | undefined;

  const backed = goals.filter((goal) => goal.funding === 'holdings' && !goal.closedAt);

  // Nothing to point at yet: a goal has to be set to read its holdings before it can have any.
  if (!backed.length) return null;

  return (
    <>
      <Field.Select
        name="assignedGoalId"
        label={i18n.t('holdings.assigned_to')}
        helperText={i18n.t('holdings.assigned_to_helper')}
        fullWidth
        options={[
          { label: i18n.t('holdings.unassigned'), value: UNASSIGNED },
          ...backed.map((goal) => ({ label: goal.description, value: goal.id })),
        ]}
      />

      {goalId && goalId !== UNASSIGNED && (
        <Field.Text name="assignedShare" type="number" label={i18n.t('holdings.assigned_share')} />
      )}
    </>
  );
};
