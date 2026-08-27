import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { CSV_FORMATS } from '@/lib/banks/registry.ts';
import { parserFromMapping } from '@/lib/banks/mapping.ts';
import { db } from '@/database/index.ts';
import StatementMapping from '@/features/transactions/views/statement-mapping.tsx';
import ImportReportPanel from '@/features/transactions/views/import-report.tsx';
import type { ImportReport } from '@/features/transactions/services/import-report.service.ts';
import type { BankCsvParser, CsvFormat } from '@/lib/banks/contract.ts';
import { readCandidates } from '@/lib/banks/read-statement.ts';
import { detectParser, type Detection, type DetectionCandidate } from '@/lib/banks/detect.ts';
import { addDBTransactions, applyDBSheet } from '@/database/transactions.ts';
import { SHEET_ID } from '@/lib/saldoo-sheet/format.ts';
import { readSheet } from '@/lib/saldoo-sheet/read.ts';

type CreateTransactionFormType = z.infer<typeof formSchema>;

const formSchema = z.object({
  // Not a literal union of the banks Saldoo ships: a format somebody described themselves is as
  // valid a choice as ING, and its id is only known at runtime.
  bank: z.string().min(1),
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
const StatementField = ({
  parsers,
  onRead,
}: {
  parsers: CsvFormat[];
  onRead: (candidates: DetectionCandidate[]) => void;
}) => {
  const { setValue } = useFormContext();
  const [detection, setDetection] = useState<Detection | null>(null);
  const [reading, setReading] = useState(false);
  const [file, setFile] = useState<File | undefined>();
  /** Open when the person asked to describe the format, or when nothing recognised the file. */
  const [describing, setDescribing] = useState(false);
  /** The format they just described, which is neither a detection nor a guess. */
  const [described, setDescribed] = useState<CsvFormat | null>(null);

  /**
   * Reads the file through a format somebody described, and selects it.
   *
   * Deliberately not folded into detection: a mapping saved a second ago was not *recognised*, and
   * saying so would be the app taking credit for the person's own work — and hiding, next month,
   * that this is the format that will be recognised then.
   */
  const chooseDescribed = async (parser: CsvFormat) => {
    if (!file) return;

    const candidates = await readCandidates(file, [parser]);

    onRead(candidates);
    setDescribed(parser);
    setDescribing(false);
    setValue('bank', parser.id, { shouldValidate: true });
  };

  const read = async (file?: File) => {
    setFile(file);
    setDescribed(null);
    setDescribing(false);
    setValue('file', file);
    setValue('bank', '');
    setDetection(null);
    onRead([]);

    if (!file) return;

    setReading(true);

    try {
      const candidates = await readCandidates(file, parsers);
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

  const message = described
    ? i18n.t('statement.using', { name: described.displayName })
    : detectionMessage(detection, reading);

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
        options={parsers.map((parser) => ({ value: parser.id, label: parser.displayName }))}
      />

      {file &&
        !described &&
        (describing || detection?.kind === 'unknown' ? (
          <StatementMapping file={file} onSaved={(parser) => void chooseDescribed(parser)} />
        ) : (
          <Button type="button" variant="ghost" onClick={() => setDescribing(true)}>
            {i18n.t('statement.mapping.cta')}
          </Button>
        ))}
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

  /** Kept on screen after the import rather than announced and lost: it is a thing to read. */
  const [report, setReport] = useState<{
    report: ImportReport;
    bank: string;
    fileName: string;
  } | null>(null);

  /**
   * Everything that can read a statement here: the banks Saldoo ships, and the formats this person
   * described for banks it does not. They are the same kind of thing by the time they reach the
   * screen, which is the whole point of the parser contract.
   */
  const mappings = useLiveQuery(() => db.csvMappings.toArray(), []) ?? [];
  const parsers = useMemo(
    () => [...CSV_FORMATS, ...mappings.map(parserFromMapping)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mappings.map((mapping) => `${mapping.id}:${mapping.version}`).join()]
  );

  /**
   * Reads the file with the chosen format and stores what it says.
   *
   * **The fork is here and nowhere else.** Both branches were handed the same rows by the same
   * reader, and the difference is only what the rows are allowed to ask for: a statement can say a
   * payment happened, and our own sheet can also say which record it is, what it should now read,
   * and that it should be gone. Only a format we defined can carry that, which is why only this
   * branch may update or delete anything.
   */
  const onSubmit = async (values: CreateTransactionFormType) => {
    const format = parsers.find((one) => one.id === values.bank);
    if (!format) return;

    const alreadyRead = candidates.find((candidate) => candidate.parser.id === format.id);
    const rows = alreadyRead?.rows ?? (await readCandidates(values.file, [format]))[0].rows;

    const fileName = (values.file as File | undefined)?.name ?? 'statement.csv';

    if (format.id === SHEET_ID) {
      setReport({
        report: await applyDBSheet(readSheet(rows).rows),
        bank: format.displayName,
        fileName,
      });
      return;
    }

    // Everything else on the list parses; the sheet is the only entry that does not, and it has
    // just been handled. A format with neither is not something this screen can offer.
    if (!('parse' in format)) return;

    const { transactions, warnings } = (format as BankCsvParser).parse(rows);

    setReport({
      report: await addDBTransactions(format.id, transactions, warnings),
      bank: format.displayName,
      fileName,
    });
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
              <StatementField
                parsers={parsers}
                onRead={(read) => {
                  setCandidates(read);
                  setReport(null);
                }}
              />
              <Button type="submit">{i18n.t(id === NEW_ENTITY_ID ? 'submit' : 'edit')}</Button>

              {report && (
                <ImportReportPanel
                  report={report.report}
                  bank={report.bank}
                  fileName={report.fileName}
                />
              )}
            </div>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
