import { Target } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { paths } from '@/routes/paths.ts';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { MetricCard } from '@/components/stats/metric-card.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { Button } from '@/components/ui/button.tsx';
import { formatMoney } from '@/lib/formats.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { useGoals } from '@/features/goals/hooks/use-goals.tsx';
import {
  setContributionGoalId,
  setPositionFromGoalId,
  setPositionsDrawerId,
} from '@/store/preferences.slice.ts';
import { isEmergencyFund } from '@/database/goals.ts';
import { formatCoverage, formatMonthAndYear } from '@/features/goals/services/goal-copy.service.ts';
import type { GoalProgress } from '@/features/goals/services/goal-progress.service.ts';

/**
 * What this goal does to the rest of the app, in one sentence per card.
 *
 * The screen was a register: correct figures, no consequence. Somebody could read "1 200 a month"
 * and never learn that it is why the money free on the overview went down, or that the fund's
 * target moved because their rent did. Every sentence is computed from the same figures the tiles
 * are drawn from, so none of it can drift out of step with what it describes.
 */
const Consequence = ({ row, currency }: { row: GoalProgress; currency: string }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const sentence = () => {
    if (isEmergencyFund(row.goal)) {
      return i18n.t('goal.fund_grows_with_costs', {
        months: row.goal.coverageMonths,
        target: formatMoney(row.target, currency),
        coverage: formatCoverage(row.coverageNow ?? 0),
      });
    }

    return row.takesFromFree > 0
      ? i18n.t('goal.takes_from_free', {
          amount: formatMoney(row.takesFromFree, currency),
          part: i18n.t(row.goal.strategyPart as TranslationKey),
        })
      : i18n.t('goal.takes_nothing');
  };

  return (
    <div className="flex flex-col gap-2 text-xs" data-slot="goal-consequence">
      <p>{sentence()}</p>

      {/* Named rather than only summed: "4,2 months of cover" invites the question *out of what*,
          and a card that cannot answer it asks to be taken on faith. */}
      {row.backing.length > 0 && (
        <span data-slot="goal-backing">
          {i18n.t('goal.backed_by')}{' '}
          {row.backing
            .map((one) => (one.share === 100 ? one.description : `${one.description} (${one.share}%)`))
            .join(' · ')}
        </span>
      )}

      {row.offer && (
        <p>
          {i18n.t('goal.offer', {
            pace: formatMoney(row.offer.pace, currency),
            when: formatMonthAndYear(row.offer.deadline),
          })}
        </p>
      )}

      {/* The seam this app is asked about most: money declared aside is not a holding, and net
          worth stays where it was until somebody says what the thing is actually worth. */}
      <p>{i18n.t('goal.not_wealth')}</p>

      <Button
        variant="link"
        className="h-auto justify-start p-0 text-xs"
        // Listed out of context every card's link would read the same, so the goal names itself.
        aria-label={`${i18n.t('goal.add_to_wealth')} — ${row.goal.description}`}
        // Over to the holdings screen with the drawer open, rather than opening it here: that is
        // where the position will live, and a form that writes to a screen somebody cannot see
        // leaves them wondering whether anything happened.
        onClick={() => {
          dispatch(setPositionFromGoalId(row.goal.id));
          dispatch(setPositionsDrawerId(NEW_ENTITY_ID));
          navigate(paths.dashboard.wealth);
        }}
      >
        {i18n.t('goal.add_to_wealth')}
      </Button>
    </div>
  );
};

export function GoalsList() {
  const dispatch = useDispatch();
  const { progress, totalPutAside, confirmed, currency } = useGoals();

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
          {/* Never red and never subtracted. The rest is not wrong — it is unconfirmed, which is a
              statement about a bank's latency rather than about the person. */}
          <span className="text-muted-foreground text-sm" data-slot="confirmed-portion">
            {i18n.t('goal.confirmed_of', {
              confirmed: formatMoney(confirmed, currency),
            })}
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
                label: i18n.t(row.dueNow ? 'goal.remaining' : 'goal.per_month'),
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
status={<Consequence row={row} currency={currency} />}
            statusColor="text-muted-foreground"
            // A goal that reads its holdings is not moved by declaring anything at it, so it is not
            // offered the button that would.
            actionLabel={
              row.goal.funding === 'holdings'
                ? undefined
                : isEmergencyFund(row.goal)
                  ? i18n.t('goal.top_up')
                  : i18n.t('goal.put_aside')
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
