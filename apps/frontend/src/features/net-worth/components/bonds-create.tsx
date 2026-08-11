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
import {
  AssignmentFields,
  UNASSIGNED,
} from '@/features/net-worth/components/assignment-fields.tsx';
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { setBondsDrawerId } from '@/store/preferences.slice.ts';
import { addDBBond, updateDBBond } from '@/database/bonds.ts';
import { checkIfOpen } from '@/lib/helpers.ts';
import { formatMonthAndYear, formatPercent } from '@/lib/formats.ts';
import { useListBondOffersQuery } from '@/store/bond-offers.api.ts';
import {
  fetchedRates,
  monthsPriceableFrom,
  rateFrom,
  seriesOfferedFrom,
  type FetchedRates,
} from '@/features/net-worth/services/bond-offers.service.ts';
import {
  catalogueMonths,
  choiceFromCode,
  draftFromCatalogue,
  recentMonths,
  seriesCodeFor,
  BOND_SERIES,
  type BondSeriesCode,
} from '@/features/net-worth/services/bond-catalogue.service.ts';

const SERIES_CODES = BOND_SERIES.map((series) => series.code) as [BondSeriesCode, ...BondSeriesCode[]];

const formSchema = z.object({
  month: z.string({ error: i18n.t('errors.field-required') }),
  wrapper: z.enum(['none', 'IKE', 'IKZE']),
  /** Edited as one goal and a share; stored as the list the record carries. */
  assignedGoalId: z.string().optional(),
  assignedShare: z.number().optional(),
  series: z.enum(SERIES_CODES, { error: i18n.t('errors.field-required') }),
  quantity: z.number({ error: i18n.t('errors.field-required') }).positive(),
  // Required, but not by the schema: whether a rate has to be asked for depends on what the backend
  // has read since this bundle was built, which a module-level schema cannot see. The submit
  // decides, and reports it on this field.
  ratePercent: z.number().positive().optional(),
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
const BondFields = ({ fetched }: { fetched: FetchedRates }) => {
  const month = useWatch({ name: 'month' }) as string | undefined;
  const series = useWatch({ name: 'series' }) as BondSeriesCode | undefined;

  // Every month that can be priced, newest first — the span shipped in the bundle plus anything the
  // backend has read since. A ten-year bought in 2019 is entered as what it is, not typed in.
  const months = useMemo(
    () => [...monthsPriceableFrom(fetched, catalogueMonths())].reverse(),
    [fetched]
  );
  // Everything, when neither the bundle nor the backend has read that month: which series compounds
  // and how often has not changed in years, and it is not the part anybody has to look up.
  const offeredThen = month ? seriesOfferedFrom(fetched, month) : [];
  const offered = offeredThen.length > 0 ? offeredThen : BOND_SERIES;

  const spec = series && BOND_SERIES.find((one) => one.code === series);
  const known = series && month ? rateFrom(fetched, series, month) : undefined;

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
            month && rateFrom(fetched, one.code, month) !== undefined
              ? formatPercent(rateFrom(fetched, one.code, month)!)
              : undefined,
            one.familyOnly ? i18n.t('bonds.family_only') : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />

      <Field.Text name="quantity" type="number" label={i18n.t('bonds.quantity')} />

      {/* Asked rather than guessed: nothing on a holding says whether it sits in a retirement
          wrapper, and the tax on it is the difference between two very different figures. */}
      <AssignmentFields />

      <Field.Segmented
        name="wrapper"
        label={i18n.t('bonds.wrapper')}
        helperText={i18n.t('bonds.wrapper_helper')}
        options={[
          { label: i18n.t('bonds.wrapper_none'), value: 'none' },
          { label: 'IKE', value: 'IKE' },
          { label: 'IKZE', value: 'IKZE' },
        ]}
      />

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


/** The list the record carries, from the one goal and share the form edits. */
const assignmentsFrom = (goalId?: string, share?: number) =>
  goalId && goalId !== UNASSIGNED
    ? [{ goalId, share: Math.min(100, Math.max(0, share ?? 100)) }]
    : [];

/** And back again, for the form to open on what is already there. */
const assignmentIn = (assignments?: { goalId: string; share: number }[]) => ({
  assignedGoalId: assignments?.[0]?.goalId ?? UNASSIGNED,
  assignedShare: assignments?.[0]?.share ?? 100,
});

export default function BondsCreate() {
  const dispatch = useDispatch();
  const id = useAppSelector((state) => state.preferences.bondsDrawerId);
  const bond = useLiveQuery(() => db.bonds.get(id ?? ''), [id]);

  // Whatever the backend has read since this bundle was built. Nothing here handles a failure
  // because there is nothing to handle: no answer means no extra months, and every lookup falls
  // back to the catalogue the app ships with.
  const { data: offers } = useListBondOffersQuery();
  const fetched = useMemo(() => fetchedRates(offers), [offers]);

  const initialValues = useMemo(() => {
    if (id === NEW_ENTITY_ID)
      return {
        month: recentMonths(1, new Date())[0],
        wrapper: 'none' as const,
        ...assignmentIn(),
      };
    if (!bond) return undefined;

    // Read back out of the published name, so editing shows the month and series it was chosen by.
    const choice = choiceFromCode(bond.description);

    return {
      month: choice?.month ?? recentMonths(1, new Date(bond.boughtOn))[0],
      series: choice?.code,
      quantity: bond.quantity,
      ratePercent: bond.ratePercent,
      wrapper: bond.wrapper ?? ('none' as const),
      ...assignmentIn(bond.assignments),
    };
  }, [id, bond]);

  const handleSubmit = async (values: BondCreateType) => {
    if (!id) return;

    const draft = draftFromCatalogue({
      code: values.series,
      month: values.month,
      quantity: values.quantity,
      ratePercent: values.ratePercent ?? rateFrom(fetched, values.series, values.month),
    });

    // The catalogue knows the series, never where somebody keeps it or what it is for.
    if (draft) {
      draft.wrapper = values.wrapper;
      draft.assignments = assignmentsFrom(values.assignedGoalId, values.assignedShare);
    }

    // No rate anywhere and none given: say so on the field that would carry it, rather than closing
    // over a holding with no value.
    if (!draft) return { ratePercent: i18n.t('errors.field-required') };

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
            <BondFields fetched={fetched} />
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
