import { Button } from '@/components/ui/button.tsx';
import i18n from '@/i18n.ts';
import { PageHeader } from '@/components/page-header.tsx';
import { useDispatch } from 'react-redux';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { setGoalsDrawerId } from '@/store/preferences.slice.ts';
import GoalsCreate from '@/features/goals/components/goals-create.tsx';
import ContributionCreate from '@/features/goals/components/contribution-create.tsx';
import { GoalsList } from '@/features/goals/components/goals-list.tsx';

export default function Goals() {
  const dispatch = useDispatch();

  return (
    <>
      <PageHeader title={i18n.t('goal.title')} description={i18n.t('goal.subtitle')}>
        <Button onClick={() => dispatch(setGoalsDrawerId(NEW_ENTITY_ID))}>
          {i18n.t('goal.create')}
        </Button>
      </PageHeader>

      <GoalsCreate />
      <ContributionCreate />

      <GoalsList />
    </>
  );
}
