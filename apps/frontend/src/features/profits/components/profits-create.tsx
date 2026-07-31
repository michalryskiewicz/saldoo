import i18n from '@/i18n.ts';
import { NEW_ENTITY_ID } from '@/constant.ts';
import { Field, Form } from '@/components/hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '@/store/store.ts';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { addDBProfit, updateDBProfit } from '@/database/profits.ts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { serProfitsDrawerId } from '@/store/preferences.slice.ts';
import { checkIfOpen } from '@/lib/helpers';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  profit: z.number({ error: i18n.t('errors.field-required') }),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  frequency: z.string({ error: i18n.t('errors.field-required') }),
  execution: z.date({ error: i18n.t('errors.field-required') }),
});

export type ProfitCreateSchema = z.infer<typeof formSchema>;

const defaultValues = {
  currency: 'PLN',
};

export default function ProfitsCreatePage() {
  const dispatch = useDispatch();

  const id = useAppSelector((state) => state.preferences.profitsDrawerId);
  const profit = useLiveQuery(() => db.profits.get(id ?? ''), [id]);

/**
 * Today, as the date this is most likely to be.
 *
 * Computed per opening rather than in the module's own defaults: a `new Date()` there is evaluated
 * once when the module is first imported, so a tab left open across midnight would go on offering
 * yesterday.
 */
  const initialValues = useMemo(
    () => (id === NEW_ENTITY_ID ? { ...defaultValues, execution: new Date() } : profit ?? defaultValues),
    [profit, id]
  );

  const handleSubmit = async (values: ProfitCreateSchema): Promise<void> => {
    if (!id) return;

    const saved =
      id === NEW_ENTITY_ID ? await addDBProfit(values) : await updateDBProfit(id, values);
    if (!saved) return;

    dispatch(serProfitsDrawerId(''));
  };

  return (
    <Sheet
      open={checkIfOpen(id, profit)}
      onOpenChange={(value) => {
        if (!value) {
          dispatch(serProfitsDrawerId(''));
        }
      }}
    >
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('create_profits_title')}</SheetTitle>
          <SheetDescription>{i18n.t('create_profits_description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-1.5 p-4">
          <Form
            initialValues={initialValues}
            schema={formSchema}
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-5">
              <Field.Text name="description" label={i18n.t('description')} />

              <Field.Money name="profit" currencyField="currency" label={i18n.t('profit')} />

              <Field.Select
                fullWidth
                name="frequency"
                label={i18n.t('frequency')}
                options={[
                  { label: i18n.t('DAILY'), value: 'DAILY' },
                  { label: i18n.t('WEEKLY'), value: 'WEEKLY' },
                  { label: i18n.t('MONTHLY'), value: 'MONTHLY' },
                  { label: i18n.t('YEARLY'), value: 'YEARLY' },
                ]}
              />
              <Field.Date
                name="execution"
                label={i18n.t('execution')}
                fullWidth
                placeholder={i18n.t('execution_placeholder')}
              />

              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
