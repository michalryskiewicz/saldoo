import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
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
import { toast } from 'sonner';
import { BANK_PARSERS, parserById } from '@/lib/banks/registry.ts';
import { readCandidates } from '@/lib/banks/read-statement.ts';
import { detectParser, type Detection, type DetectionCandidate } from '@/lib/banks/detect.ts';
import { addDBTransactions } from '@/database/transactions.ts';

type CreateTransactionFormType = z.infer<typeof formSchema>;

const formSchema = z.object({
  // A string checked against the registry rather than a literal union: the list of banks lives in
  // one place, and a union here would be the copy that goes stale the first time one is added.
  bank: z.string().refine((id) => !!parserById(id)),
  file: z.any(),
});

/** What the app concluded about the file, in words, and never as a bare percentage. */
const detectionMessage = (detection: Detection | null, reading: boolean): string | null => {
  if (reading) return i18n.t('statement.detecting');
  if (!detection) return null;

  if (detection.kind === 'certain') {
    return i18n.t('statement.detected', { bank: detection.chosen.parser.displayName });
  }

  if (detection.kind === 'ambiguous') {
    return i18n.t('statement.ambiguous', {
      banks: detection.options.map((option) => option.parser.displayName).join(', '),
    });
  }

  return i18n.t('statement.unknown');
};

/**
 * The file, and what reading it told us about which bank wrote it.
 *
 * The order on screen is the order of the questions now: the file first, because the answer to
 * "which bank" is usually in it. A person exporting from ING should not have to tell us what the
 * header of their own file already says.
 *
 * **Only a header found intact selects a bank on somebody's behalf.** A parser reading the wrong
 * bank's file does not fail — it files plausible payments from the wrong columns, and a wrong date
 * or a sign flipped is not something anybody catches in a table of four hundred rows. So a close
 * match is named and offered, never chosen.
 */
const StatementField = ({ onRead }: { onRead: (candidates: DetectionCandidate[]) => void }) => {
  const { setValue } = useFormContext();
  const [detection, setDetection] = useState<Detection | null>(null);
  const [reading, setReading] = useState(false);

  const read = async (file?: File) => {
    setValue('file', file);
    setValue('bank', '');
    setDetection(null);
    onRead([]);

    if (!file) return;

    setReading(true);

    try {
      const candidates = await readCandidates(file, BANK_PARSERS);
      const detected = detectParser(candidates);

      onRead(candidates);
      setDetection(detected);

      if (detected.kind === 'certain') {
        setValue('bank', detected.chosen.parser.id, { shouldValidate: true });
      }
    } finally {
      setReading(false);
    }
  };

  const message = detectionMessage(detection, reading);

  return (
    <>
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
                  onChange={(e) => void read(e.target.files?.[0])}
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

      {message && (
        <p data-testid="import-detection" className="text-muted-foreground text-sm">
          {message}
        </p>
      )}

      <Field.RadioGroup
        label={i18n.t('bank_description')}
        name="bank"
        options={BANK_PARSERS.map((parser) => ({ value: parser.id, label: parser.displayName }))}
      />
    </>
  );
};

export default function TransactionsCreate() {
  const dispatch = useDispatch();

  const id = useAppSelector((state) => state.preferences.transactionsDrawerId);

  /**
   * The rows detection already read, kept so importing does not read the file a second time.
   * Empty whenever the file changed and detection has not finished with it.
   */
  const [candidates, setCandidates] = useState<DetectionCandidate[]>([]);

  const onSubmit = async (values: CreateTransactionFormType) => {
    const parser = parserById(values.bank);
    if (!parser) return;

    const alreadyRead = candidates.find((candidate) => candidate.parser.id === parser.id);
    const rows = alreadyRead?.rows ?? (await readCandidates(values.file, [parser]))[0].rows;

    const { transactions, warnings } = parser.parse(rows);

    await addDBTransactions(parser.id, transactions);

    // Said once, with a count, rather than per row: the full per-row report is #16. Silence would
    // be worse than either — a row skipped without a word is a payment missing from a month.
    if (warnings.length) toast(i18n.t('statement.skipped_rows', { count: warnings.length }));
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
              <StatementField onRead={setCandidates} />
              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
