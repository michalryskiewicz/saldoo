import { Field, Form } from '@/components/hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { NEW_ENTITY_ID } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { useCategories } from '@/features/hooks/use-categories.tsx';
import { useDispatch } from 'react-redux';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { setExpensesDrawerId } from '@/store/preferences.slice.ts';
import { addDBExpense, updateDBExpense } from '@/database/expenses.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';
import { useAppSelector } from '@/store/store.ts';
import { checkIfOpen } from '@/lib/helpers.ts';

const formSchema = z.object({
  description: z
    .string({ error: i18n.t('errors.field-required') })
    .min(2, i18n.t('errors.min-2-length-required')),
  expense: z.number({ error: i18n.t('errors.field-required') }),
  currency: z.string({ error: i18n.t('errors.field-required') }),
  severity: z.string({ error: i18n.t('errors.field-required') }),
  frequency: z.string({ error: i18n.t('errors.field-required') }),
  execution: z.date({ error: i18n.t('errors.field-required') }),
  tagId: z.string({ error: i18n.t('errors.field-required') }),
  strategyPart: z.string({ error: i18n.t('errors.field-required') }),
});

export type ExpenseCreateType = z.infer<typeof formSchema>;

const defaultValues = {
  currency: 'PLN',
  severity: 'MEDIUM',
  frequency: 'WEEKLY',
  tags: [],
};

export default function ExpensesCreate() {
  const dispatch = useDispatch();

  const { budgetingPartsOptions, tags } = useCategories();

  const id = useAppSelector((state) => state.preferences.expensesDrawerId);
  const expense = useLiveQuery(() => db.expenses.get(id ?? ''), [id]);

  const handleSubmit = async (values: ExpenseCreateType) => {
    if (!id) return;

    const saved =
      id === NEW_ENTITY_ID ? await addDBExpense(values) : await updateDBExpense(id, values);

    // Staying open is the point: a drawer that shuts either way is why a failed save was
    // indistinguishable from a successful one, and the toast alone was easy to miss.
    if (!saved) return;

    return dispatch(setExpensesDrawerId(''));
  };

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <Sheet
      open={checkIfOpen(id, expense)}
      onOpenChange={(value) => {
        if (!value) {
          dispatch(setExpensesDrawerId(''));
        }
      }}
    >
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('create_expense_title')}</SheetTitle>
          <SheetDescription>{i18n.t('create_expense_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form
            //eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            initialValues={expense ?? defaultValues}
            schema={formSchema}
            onSubmit={handleSubmit}
            //eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            resetFields={!expense && { description: '', expense: undefined }}
          >
            <div className="flex flex-col gap-5">
              <Field.Text name="description" label={i18n.t('description')} />

              <Field.Money name="expense" currencyField="currency" label={i18n.t('expense')} />

              <Field.Select
                fullWidth
                name="severity"
                label={i18n.t('severity')}
                options={[
                  { label: i18n.t('LOW'), value: 'LOW' },
                  { label: i18n.t('MEDIUM'), value: 'MEDIUM' },
                  { label: i18n.t('HIGH'), value: 'HIGH' },
                ]}
              />

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

              <Field.AutoComplete
                name="tagId"
                label={i18n.t('forms.category')}
                fullWidth
                helperText={i18n.t('forms.category-helper-text')}
                placeholder={i18n.t('forms.category-placeholder')}
                options={tags}
              />

              <Field.Select
                fullWidth
                name="strategyPart"
                label={i18n.t('forms.strategy-part')}
                infoTooltip={i18n.t('forms.strategy-part-tooltip')}
                options={budgetingPartsOptions}
              />

              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
