import i18n from '@/i18n.ts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx';
import { Field, Form } from '@/components/hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { NEW_ENTITY_ID } from '@/constant.ts';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx';
import { Input } from '@/components/ui/input.tsx';
import { cn } from '@/lib/utils.ts';
import { useAppSelector } from '@/store/store.ts';
import { checkIfOpen } from '@/lib/helpers.ts';
import { setTransactionsDrawerId } from '@/store/preferences.slice.ts';
import { useDispatch } from 'react-redux';
import Papa from 'papaparse';
import { getBankSchema } from '@/lib/transactions.ts';
import { addDBTransactions } from '@/database/transactions.ts';

type CreateTransactionFormType = z.infer<typeof formSchema>;

const formSchema = z.object({
  bank: z.enum(['ING', 'PKOBP']),
  file: z.any(),
});

export default function TransactionsCreate() {
  const dispatch = useDispatch();

  const id = useAppSelector((state) => state.preferences.transactionsDrawerId);

  const onSubmit = async (values: CreateTransactionFormType) => {
    const schema = getBankSchema(values.bank);

    if (schema) {
      // On this thread rather than in a worker. Papa spawns its worker from a `blob:` URL, and
      // the shipped Content-Security-Policy refuses it — `worker-src` is unset, so `script-src
      // 'self'` is what it falls back to. The upload then died in silence: no rows stored, and
      // no error shown either, because the `complete` that reports both never ran. A bank
      // statement is a few thousand rows; the thread it parses on was never worth an exception
      // in a policy this app's whole claim rests on.
      Papa.parse(values.file, {
        encoding: schema.encoding,
        delimiter: schema.delimiter,
        step: schema.step,
        complete: async function () {
          const rows = schema.getRows ? schema.getRows() : [];
          await addDBTransactions(values.bank, rows);
        },
      });
    }
  };

  return (
    <Sheet
      open={checkIfOpen(id)}
      onOpenChange={(value) => {
        if (!value) {
          dispatch(setTransactionsDrawerId(''));
        }
      }}
    >
      <SheetContent className="xl:w-[540px] xl:max-w-none sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{i18n.t('add_transactions')}</SheetTitle>
          <SheetDescription>{i18n.t('add_transactions_description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1.5 p-4">
          <Form schema={formSchema} onSubmit={onSubmit}>
            <div className="flex flex-col gap-5">
              <Field.RadioGroup
                label={i18n.t('bank_description')}
                name="bank"
                options={[
                  { value: 'ING', label: 'ING Bank Śląski' },
                  { value: 'PKOBP', label: 'PKO BP' },
                ]}
              />
              <FormField
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plik .csv</FormLabel>
                    <FormControl>
                      <div>
                        <Input
                          id="file-input"
                          style={{ display: 'none' }}
                          accept=".csv"
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            field.onChange(file);
                          }}
                        />
                        <FormLabel
                          htmlFor="file-input"
                          className={cn(
                            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
                          )}
                        >
                          {field.value ? field.value?.name : 'Wybierz plik'}
                        </FormLabel>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Dodaj plik csv z danymi dotyczącymi Twoich transakcji
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
