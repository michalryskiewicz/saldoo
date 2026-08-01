import { useWatch } from 'react-hook-form';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { FREQUENCY } from '@/constant.ts';
import { CADENCE, CADENCES_IN_ORDER } from '@/lib/recurrence-presets.ts';
import { RHFSelect } from '@/components/hook-form/rhf-select.tsx';
import { RHFTextField } from '@/components/hook-form/rhf-text-field.tsx';

const UNIT_KEY: Record<FREQUENCY, string> = {
  [FREQUENCY.DAILY]: 'units.day',
  [FREQUENCY.WEEKLY]: 'units.week',
  [FREQUENCY.MONTHLY]: 'units.month',
  [FREQUENCY.YEARLY]: 'units.year',
};

/**
 * How often a thing repeats, asked as one question.
 *
 * The rule needs a unit and a step, but nobody says "Miesięczna, 3" — they say "co kwartał". So
 * the named cadences are offered whole and the two fields behind them stay out of the way until
 * `CUSTOM` is chosen, which is what keeps an unusual cycle expressible at all.
 *
 * The unit is declined by the number standing in front of it: Polish reads "co 2 tygodnie" and
 * "co 5 tygodni", and a select that said "tygodni" beside a 2 would be wrong in the one place
 * the user is looking.
 */
export function RHFCadenceField() {
  // `useWatch` rather than `watch`: the latter re-renders the component that called `useForm`,
  // and this field arrives there as an unchanged `children` element, so React skips it — the
  // custom row never appeared however the select was answered.
  const cadence = useWatch({ name: 'cadence' });
  const interval = Number(useWatch({ name: 'interval' })) || 1;

  return (
    <div className="flex flex-col gap-3">
      <RHFSelect
        fullWidth
        name="cadence"
        label={i18n.t('forms.cadence')}
        options={CADENCES_IN_ORDER.map((value) => ({
          value,
          label: i18n.t(`cadence.${value}` as TranslationKey),
        }))}
      />

      {cadence === CADENCE.CUSTOM && (
        <div className="flex items-end gap-2">
          <span className="pb-2 text-sm text-muted-foreground">{i18n.t('cadence.every')}</span>
          <div className="w-20 shrink-0">
            <RHFTextField name="interval" type="number" label="" aria-label={i18n.t('cadence.every')} />
          </div>
          <div className="flex-1">
            <RHFSelect
              fullWidth
              name="frequency"
              label=""
              ariaLabel={i18n.t('forms.cadence-unit')}
              options={Object.values(FREQUENCY).map((value) => ({
                value,
                label: i18n.t(UNIT_KEY[value] as TranslationKey, { count: interval }),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
