import { z } from 'zod';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
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

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  quantity: z.number({ error: i18n.t('errors.field-required') }).positive(),
  nominal: z.number({ error: i18n.t('errors.field-required') }).positive(),
  boughtOn: z.date({ error: i18n.t('errors.field-required') }),
  ratePercent: z.number({ error: i18n.t('errors.field-required') }).positive(),
  interest: z.enum(['compounds', 'pays out']),
  period: z.enum(['monthly', 'yearly']),
  currency: z.string({ error: i18n.t('errors.field-required') }),
});

type BondCreateType = z.infer<typeof formSchema>;

export default function BondsCreate() {
  const dispatch = useDispatch();
  const id = useAppSelector((state) => state.preferences.bondsDrawerId);
  const bond = useLiveQuery(() => db.bonds.get(id ?? ''), [id]);

  // The nominal of every retail series is 100 today, and it is still a default rather than an
  // assumption: a series that changed it would otherwise be silently wrong.
  const initialValues = useMemo(
    () =>
      id === NEW_ENTITY_ID
        ? {
            nominal: 100,
            interest: 'compounds' as const,
            period: 'yearly' as const,
            currency: 'PLN',
            boughtOn: new Date(),
          }
        : bond,
    [id, bond]
  );

  const handleSubmit = async (values: BondCreateType) => {
    if (!id) return;

    const saved =
      id === NEW_ENTITY_ID
        ? await addDBBond(values as never)
        : await updateDBBond(id, values as never);

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
            <div className="flex flex-col gap-7">
              <Field.Text name="description" label={i18n.t('bonds.series')} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field.Text name="quantity" type="number" label={i18n.t('bonds.quantity')} />
                <Field.Money name="nominal" currencyField="currency" label={i18n.t('bonds.nominal')} />
              </div>

              <Field.Date name="boughtOn" label={i18n.t('bonds.bought_on')} fullWidth />

              <Field.Text
                name="ratePercent"
                type="number"
                label={i18n.t('bonds.rate')}
                helperText={i18n.t('bonds.rate_helper')}
              />

              {/* The two properties that tell every retail series apart, asked instead of naming
                  them: hard-coding five formulas is how a confident figure goes subtly wrong. */}
              <Field.Segmented
                name="interest"
                label={i18n.t('bonds.interest')}
                helperText={i18n.t('bonds.interest_helper')}
                options={[
                  { label: i18n.t('bonds.compounds'), value: 'compounds' },
                  { label: i18n.t('bonds.pays_out'), value: 'pays out' },
                ]}
              />

              <Field.Segmented
                name="period"
                label={i18n.t('bonds.period')}
                options={[
                  { label: i18n.t('bonds.yearly'), value: 'yearly' },
                  { label: i18n.t('bonds.monthly'), value: 'monthly' },
                ]}
              />

              <Button type="submit">{i18n.t('submit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
