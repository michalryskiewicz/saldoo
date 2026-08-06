import { useWatch } from 'react-hook-form';
import { Field } from '@/components/hook-form';
import i18n from '@/i18n.ts';

type ExpenseAmountFieldsProps = {
  incomes: { label: string; value: string }[];
};

/**
 * How much this cost is: an amount somebody typed, or a share of a named income.
 *
 * Its own component, and rendered as a child of `Form` rather than beside the other fields,
 * because it has to react to a field's value. `Form` takes its children as a **prop**, so they are
 * built in the parent's render — outside the provider — where `watch()` reads the value once and
 * then never changes, and a conditional field would never appear. `useWatch` here subscribes from
 * inside the provider, which is the only place it works.
 *
 * The question about the emergency fund is deliberately absent for a share: a share of an income is
 * zero when there is no income, so it is never in the fund and asking would be offering a choice
 * that changes nothing.
 */
export const ExpenseAmountFields = ({ incomes }: ExpenseAmountFieldsProps) => {
  const amountMode = useWatch({ name: 'amountMode' });

  return (
    <>
      <Field.Segmented
        name="amountMode"
        label={i18n.t('amount_mode.label')}
        options={[
          { label: i18n.t('amount_mode.fixed'), value: 'fixed' },
          { label: i18n.t('amount_mode.share'), value: 'share' },
        ]}
      />

      {amountMode === 'share' ? (
        <>
          <Field.Text
            name="percent"
            type="number"
            label={i18n.t('amount_mode.percent')}
            helperText={i18n.t('amount_mode.percent-helper')}
          />

          <Field.MultiAutoComplete
            name="profitIds"
            label={i18n.t('amount_mode.of-income')}
            options={incomes}
            noneSelectedText={i18n.t('amount_mode.no-income-selected')}
            placeholder={i18n.t('amount_mode.search-income')}
            emptyText={i18n.t('amount_mode.no-income-found')}
            helperText={i18n.t('amount_mode.of-income-helper')}
          />

          <Field.Segmented
            name="basePeriod"
            label={i18n.t('amount_mode.base-period')}
            helperText={i18n.t('amount_mode.base-period-helper')}
            options={[
              { label: i18n.t('amount_mode.previous-month'), value: 'previousMonth' },
              { label: i18n.t('amount_mode.this-month'), value: 'thisMonth' },
            ]}
          />
        </>
      ) : (
        <Field.Money name="expense" currencyField="currency" label={i18n.t('expense')} />
      )}
    </>
  );
};

/**
 * Whether this cost survives losing the income — asked only when it is a cost with an amount.
 *
 * Same reason this is a child component rather than a line in the form: the answer depends on
 * another field's value, and only `useWatch` sees that change.
 */
export const ExpenseFundQuestion = () => {
  const amountMode = useWatch({ name: 'amountMode' });

  if (amountMode === 'share') return null;

  return (
    <Field.Segmented
      name="survivesIncomeLoss"
      label={i18n.t('cost_nature.question')}
      helperText={i18n.t('cost_nature.helper')}
      options={[
        { label: i18n.t('cost_nature.irreducible'), value: 'yes' },
        { label: i18n.t('cost_nature.reducible'), value: 'no' },
      ]}
    />
  );
};
