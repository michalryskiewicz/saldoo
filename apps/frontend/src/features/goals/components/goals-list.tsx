import { Target } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { MetricCard } from '@/components/stats/metric-card.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { formatMoney } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import { useGoals } from '@/features/goals/hooks/use-goals.tsx';
import { setContributionGoalId } from '@/store/preferences.slice.ts';
import { isEmergencyFund } from '@/database/goals.ts';
import { formatMonthAndYear } from '@/features/goals/services/goal-copy.service.ts';

export function GoalsList() {
  const dispatch = useDispatch();
  const { progress, totalPutAside, currency } = useGoals();

  if (!progress.length) {
    return (
      <Card>
        <CardContent>
          {/* No call to action here: the page header already carries the only button there is,
              and a second one that opens the same drawer is two answers to one question. */}
          <EmptyState icon={Target} description={i18n.t('goal.empty')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A stock, not a streak: it stops growing when somebody stops, and never falls. */}
      <Card>
        <CardContent className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {i18n.t('goal.total_put_aside')}
          </span>
          <span className="text-3xl font-semibold tabular-nums" data-slot="total-put-aside">
            {formatMoney(totalPutAside, currency)}
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {progress.map((row) => (
          <MetricCard
            key={row.goal.id}
            title={row.goal.description}
            value={formatMoney(row.saved, currency)}
            limit={formatMoney(row.target, currency)}
            percentage={row.percentage}
            progressColor="bg-info"
            details={[
              row.requiredMonthly !== undefined && {
                label: i18n.t('goal.per_month'),
                value: formatMoney(row.requiredMonthly, currency),
                color: 'bg-muted-foreground',
              },
              row.completesOn && {
                label: i18n.t('goal.ready_by'),
                value: formatMonthAndYear(row.completesOn),
                color: 'bg-muted-foreground',
              },
              row.lifetime !== undefined && {
                label: i18n.t(
                  row.goal.keepsItsMoney ? 'goal.held_in_total' : 'goal.funded_in_total'
                ),
                value: formatMoney(row.lifetime, currency),
                color: 'bg-muted-foreground',
              },
            ].filter((detail) => Boolean(detail)) as { label: string; value: string; color: string }[]}
            actionLabel={
              isEmergencyFund(row.goal) ? i18n.t('goal.top_up') : i18n.t('goal.put_aside')
            }
            // Every card's button says the same word, so the goal's name goes into the accessible
            // name: listed out of context, "Odłóż" three times is three identical buttons.
            actionName={`${isEmergencyFund(row.goal) ? i18n.t('goal.top_up') : i18n.t('goal.put_aside')} — ${row.goal.description}`}
            onActionClick={() => dispatch(setContributionGoalId(row.goal.id))}
          />
        ))}
      </div>
    </div>
  );
}
