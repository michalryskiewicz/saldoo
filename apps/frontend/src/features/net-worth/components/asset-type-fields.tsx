import { useWatch } from 'react-hook-form';
import { Field } from '@/components/hook-form';
import { ASSET_TYPE } from '@/constant.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import {
  assetTypeFrom,
  isPricedPerUnit,
  UNTYPED,
  worthFromUnits,
} from '@/features/net-worth/services/unit-priced-worth.service.ts';
import { formatMoney } from '@/lib/formats.ts';

/**
 * What a holding is, and what it is worth — one question in two halves.
 *
 * They live together because for some kinds the second half *is* the first: an ETF holding is known as
 * "100 × 4,32", and a savings account has no unit price at all. Which kinds those are is
 * `isPricedPerUnit` rather than a list repeated here.
 *
 * Where a holding is counted, the worth stops being typed and starts being shown — the count and the
 * price are what somebody knows, and the multiplication is not theirs to do. It is still on the screen
 * rather than hidden, because the figure every other screen prints should be visible where it is set.
 *
 * Leaving the type unsaid is allowed, and is not the same as choosing "Other": an allocation counts the
 * untyped apart, so what is unanswered stays visible instead of the app answering it.
 */
export const AssetTypeFields = () => {
  // Watched rather than passed in: the currency is a field of this same form, and a prop would be a
  // second copy of it that could lag a keystroke behind the switch the user just clicked.
  const currency = useWatch({ name: 'currency' }) as string | undefined;
  const assetType = useWatch({ name: 'assetType' }) as string | undefined;
  const units = useWatch({ name: 'units' }) as number | undefined;
  const unitPrice = useWatch({ name: 'unitPrice' }) as number | undefined;

  const counted = isPricedPerUnit(assetTypeFrom(assetType));
  const worth = worthFromUnits({ units, unitPrice });

  return (
    <>
      <Field.Select
        name="assetType"
        label={i18n.t('holdings.asset_type')}
        helperText={i18n.t('holdings.asset_type_helper')}
        fullWidth
        options={[
          { label: i18n.t('holdings.untyped'), value: UNTYPED },
          ...Object.values(ASSET_TYPE).map((type) => ({
            label: i18n.t(`holdings.type.${type}` as TranslationKey),
            value: type,
          })),
        ]}
      />

      {counted ? (
        <>
          <Field.Text name="units" type="number" label={i18n.t('holdings.units')} />
          <Field.Money
            name="unitPrice"
            currencyField="currency"
            label={i18n.t('holdings.unit_price')}
            helperText={i18n.t('holdings.units_helper')}
          />
          <p className="text-muted-foreground text-sm" data-slot="worth-from-units">
            {i18n.t('holdings.value')}:{' '}
            <span className="text-foreground tabular-nums">
              {formatMoney(worth ?? 0, currency ?? 'PLN', 'pl')}
            </span>
          </p>
        </>
      ) : (
        <Field.Money name="value" currencyField="currency" label={i18n.t('holdings.value')} />
      )}
    </>
  );
};
