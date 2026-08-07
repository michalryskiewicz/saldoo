import { z } from 'zod';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWatch } from 'react-hook-form';
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
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { setBondsDrawerId } from '@/store/preferences.slice.ts';
import { addDBBond, updateDBBond } from '@/database/bonds.ts';
import { checkIfOpen } from '@/lib/helpers.ts';
import { formatMonthAndYear, formatPercent } from '@/lib/formats.ts';
import {
  choiceFromCode,
  draftFromCatalogue,
  rateFor,
  recentMonths,
  seriesCodeFor,
  seriesOfferedIn,
  BOND_SERIES,
  type BondSeriesCode,
} from '@/features/net-worth/services/bond-catalogue.service.ts';

/** Five years back. Long enough for anything somebody still holds and short enough to scroll. */
const MONTHS_OFFERED = 60;

const SERIES_CODES = BOND_SERIES.map((series) => series.code) as [BondSeriesCode, ...BondSeriesCode[]];

const formSchema = z
  .object({
    month: z.string({ error: i18n.t('errors.field-required') }),
    series: z.enum(SERIES_CODES, { error: i18n.t('errors.field-required') }),
    quantity: z.number({ error: i18n.t('errors.field-required') }).positive(),
    ratePercent: z.number().positive().optional(),
  })
  // Asked for only where the catalogue cannot answer, and required there: a holding with no rate
  // has no value, and defaulting one would be the app inventing a figure about real money.
  .refine((values) => rateFor(values.series, values.month) !== undefined || !!values.ratePercent, {
    path: ['ratePercent'],
    error: i18n.t('errors.field-required'),
  });

type BondCreateType = z.infer<typeof formSchema>;

const tenorLabel = (months: number) =>
  months % 12 === 0
    ? i18n.t('bonds.tenor_years', { count: months / 12 })
    : i18n.t('bonds.tenor_months', { count: months });

const laterPeriodsLabel = (code: BondSeriesCode) => {
  const series = BOND_SERIES.find((one) => one.code === code)!;

  if (series.laterPeriods === 'fixed') return i18n.t('bonds.later_fixed');

  return series.laterPeriods === 'inflation'
    ? i18n.t('bonds.later_inflation', { margin: series.margin })
    : i18n.t('bonds.later_nbp', { margin: series.margin });
};

/**
 * The three things a person knows, and everything the app works out from them.
 *
 * Its own component because it reads the form as it is being filled in: `Form` takes its children
 * as a prop, so anything watching from outside is frozen at the first render and the series list
 * would keep offering last month's.
 */
const BondFields = () => {
  const month = useWatch({ name: 'month' }) as string | undefined;
  const series = useWatch({ name: 'series' }) as BondSeriesCode | undefined;

  const months = useMemo(() => recentMonths(MONTHS_OFFERED, new Date()), []);
  // Everything, when the catalogue has never read that month: which series compounds and how often
  // has not changed in years, and it is not the part anybody has to look up.
  const offered = month && seriesOfferedIn(month).length > 0 ? seriesOfferedIn(month) : BOND_SERIES;

  const spec = series && BOND_SERIES.find((one) => one.code === series);
  const known = series && month ? rateFor(series, month) : undefined;

  return (
    <div className="flex flex-col gap-7">
      <Field.Select
        name="month"
        label={i18n.t('bonds.month')}
        helperText={i18n.t('bonds.month_helper')}
        fullWidth
        options={months.map((value) => ({ label: formatMonthAndYear(value), value }))}
      />

      <Field.Select
        name="series"
        label={i18n.t('bonds.series')}
        helperText={i18n.t('bonds.series_helper')}
        fullWidth
        options={offered.map((one) => ({
          value: one.code,
          label: [
            one.code,
            tenorLabel(one.tenorMonths),
            month && rateFor(one.code, month) !== undefined
              ? formatPercent(rateFor(one.code, month)!)
              : undefined,
            one.familyOnly ? i18n.t('bonds.family_only') : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />

      <Field.Text name="quantity" type="number" label={i18n.t('bonds.quantity')} />

      {/* Only where the catalogue cannot answer. Everywhere else the rate is a fact the app
          already holds, and asking for it again is asking somebody to check the app's homework. */}
      {series && month && known === undefined && (
        <Field.Text
          name="ratePercent"
          type="number"
          label={i18n.t('bonds.rate')}
          helperText={i18n.t('bonds.rate_unknown')}
        />
      )}

      {spec && (
        <div className="bg-muted/40 text-muted-foreground flex flex-col gap-1 rounded-md p-3 text-sm">
          <span className="text-foreground font-medium">
            {month ? seriesCodeFor(spec.code, month) : spec.code}
          </span>
          <span>
            {spec.interest === 'compounds' ? i18n.t('bonds.compounds') : i18n.t('bonds.pays_out')}
            {' · '}
            {spec.period === 'yearly' ? i18n.t('bonds.yearly') : i18n.t('bonds.monthly')}
          </span>
          <span>{laterPeriodsLabel(spec.code)}</span>
        </div>
      )}

      <Button type="submit">{i18n.t('submit')}</Button>
    </div>
  );
};

export default function BondsCreate() {
  const dispatch = useDispatch();
  const id = useAppSelector((state) => state.preferences.bondsDrawerId);
  const bond = useLiveQuery(() => db.bonds.get(id ?? ''), [id]);

  const initialValues = useMemo(() => {
    if (id === NEW_ENTITY_ID) return { month: recentMonths(1, new Date())[0] };
    if (!bond) return undefined;

    // Read back out of the published name, so editing shows the month and series it was chosen by.
    const choice = choiceFromCode(bond.description);

    return {
      month: choice?.month ?? recentMonths(1, new Date(bond.boughtOn))[0],
      series: choice?.code,
      quantity: bond.quantity,
      ratePercent: bond.ratePercent,
    };
  }, [id, bond]);

  const handleSubmit = async (values: BondCreateType) => {
    if (!id) return;

    const draft = draftFromCatalogue({
      code: values.series,
      month: values.month,
      quantity: values.quantity,
      ratePercent: values.ratePercent,
    });

    if (!draft) return;

    const saved = id === NEW_ENTITY_ID ? await addDBBond(draft) : await updateDBBond(id, draft);
    if (!saved) return;

    dispatch(setBondsDrawerId(''));
  };

  return (
    <Sheet
      open={checkIfOpen(id, bond)}
      onOpenChange={(open) => !open && dispatch(setBondsDrawerId(''))}
    >
      <SheetContent className="xl:w-[480px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('bonds.create_title')}</SheetTitle>
          <SheetDescription>{i18n.t('bonds.create_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form initialValues={initialValues} schema={formSchema} onSubmit={handleSubmit}>
            <BondFields />
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
