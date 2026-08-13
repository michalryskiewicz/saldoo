import { useWatch } from 'react-hook-form';
import { Field } from '@/components/hook-form';
import { ASSET_TYPE } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { targetSum } from '@/features/net-worth/services/allocation.service.ts';
import { cn } from '@/lib/utils.ts';

/**
 * What share of the holdings each kind is meant to be.
 *
 * **Typed in rather than chosen from a profile.** Offering "cautious / balanced / adventurous" would put
 * the app in the business of saying how somebody should invest, and it is deliberately not in it — the
 * only thing it does with this figure is report the distance from it (#28: no buy/sell recommendations).
 *
 * The total is shown while it is being filled in, because a rule that only speaks on submit makes
 * somebody hunt for the row that is wrong.
 */
export const AllocationTargetFields = () => {
  const values = useWatch({ name: 'allocationTarget' }) as Record<string, number | undefined>;
  const sum = targetSum(values ?? {});

  return (
    <div className="flex flex-col gap-4">
      {Object.values(ASSET_TYPE).map((type) => (
        <Field.Text
          key={type}
          name={`allocationTarget.${type}`}
          type="number"
          label={i18n.t(`holdings.type.${type}` as TranslationKey)}
        />
      ))}

      <p
        className={cn('text-sm', sum === 100 ? 'text-muted-foreground' : 'text-warning')}
        data-slot="allocation-target-sum"
      >
        {sum === 100
          ? i18n.t('holdings.allocation.target_sum', { sum })
          : i18n.t('holdings.allocation.target_sum_error', { sum })}
      </p>
    </div>
  );
};
