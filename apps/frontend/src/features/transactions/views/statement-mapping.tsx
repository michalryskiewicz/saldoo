import { useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table.tsx';
import { cn } from '@/lib/utils.ts';
import type { BankCsvParser, RawRow } from '@/lib/banks/contract.ts';
import { readStatement } from '@/lib/banks/read-statement.ts';
import {
  DATE_FORMATS,
  parserFromMapping,
  type ColumnMap,
  type DateFormat,
} from '@/lib/banks/mapping.ts';
import { addDBCsvMapping } from '@/database/csv-mappings.ts';

/** How much of the file is shown. Enough to find the header and see what the columns hold. */
const PREVIEW_ROWS = 8;

const ENCODINGS = ['utf-8', 'cp1250', 'iso-8859-2'] as const;

const DELIMITERS = [
  { value: ';', label: 'delimiter_semicolon' },
  { value: ',', label: 'delimiter_comma' },
  { value: '\t', label: 'delimiter_tab' },
] as const;

/** What "not this one" is called, because a Radix select item cannot carry an empty value. */
const NONE = 'none';

type OptionalField = 'currency' | 'counterparty';

/**
 * Describing a bank Saldoo does not ship a parser for.
 *
 * The screen is the file itself. Somebody looking at their own statement can say which column holds
 * the date far more reliably than they can answer a form about a file they are not looking at — so
 * the first eight rows are on screen, the header is chosen by clicking the row that names the
 * columns, and every select lists those names rather than "column 3".
 *
 * **It says what it would read before anything is stored.** The count under the form is the mapping
 * being run against the file as it is being described, which is how a column picked one to the left
 * is caught in the second it is picked rather than after four hundred payments are filed wrong.
 */
export const StatementMapping = ({
  file,
  onSaved,
}: {
  file: File;
  onSaved: (parser: BankCsvParser) => void;
}) => {
  const [encoding, setEncoding] = useState<string>('utf-8');
  const [delimiter, setDelimiter] = useState<string>(';');
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headerAt, setHeaderAt] = useState<number | null>(null);
  const [columns, setColumns] = useState<Partial<ColumnMap>>({});
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD.MM.YYYY');
  const [split, setSplit] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;

    void readStatement(file, { encoding, delimiter }).then((read) => {
      if (!current) return;

      setRows(read);
      setHeaderAt(null);
      setColumns({});
    });

    return () => {
      current = false;
    };
  }, [file, encoding, delimiter]);

  const headerRow = useMemo(
    () => (headerAt === null ? [] : rows[headerAt].map((cell) => String(cell ?? ''))),
    [headerAt, rows]
  );

  /** The widest row decides, since a bank pads some rows and not others. */
  const columnCount = useMemo(
    () => rows.slice(0, PREVIEW_ROWS).reduce((widest, row) => Math.max(widest, row.length), 0),
    [rows]
  );

  const columnLabel = (index: number) =>
    headerRow[index]?.trim() || i18n.t('statement.mapping.column_n', { index: index + 1 });

  const draft = useMemo(() => {
    const { date, description } = columns;
    const hasAmount = split
      ? columns.debit !== undefined || columns.credit !== undefined
      : columns.amount !== undefined;

    if (date === undefined || description === undefined || !hasAmount) return undefined;

    return {
      name: name.trim(),
      version: 1,
      encoding,
      delimiter,
      headerRow,
      dateFormat,
      columns: {
        date,
        description,
        ...(split
          ? { debit: columns.debit, credit: columns.credit }
          : { amount: columns.amount }),
        currency: columns.currency,
        counterparty: columns.counterparty,
      } as ColumnMap,
    };
  }, [columns, split, name, encoding, delimiter, headerRow, dateFormat]);

  /** Run against the real file, not a sample of it: the row that breaks a mapping is rarely early. */
  const wouldRead = useMemo(
    () => (draft ? parserFromMapping({ ...draft, id: 'preview' }).parse(rows).transactions.length : 0),
    [draft, rows]
  );

  const save = async () => {
    if (!draft || !draft.name) return;

    setSaving(true);

    try {
      const stored = await addDBCsvMapping(draft);
      if (stored) onSaved(parserFromMapping(stored));
    } finally {
      setSaving(false);
    }
  };

  const columnSelect = (
    field: keyof ColumnMap,
    label: string,
    { optional = false }: { optional?: boolean } = {}
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={columns[field] === undefined ? NONE : String(columns[field])}
        onValueChange={(value) =>
          setColumns((current) => ({
            ...current,
            [field]: value === NONE ? undefined : Number(value),
          }))
        }
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={i18n.t('statement.mapping.choose_column')} />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>—</SelectItem>}
          {Array.from({ length: columnCount }, (_, index) => (
            <SelectItem key={index} value={String(index)}>
              {columnLabel(index)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="statement-mapping">
      <div>
        <h3 className="text-sm font-medium">{i18n.t('statement.mapping.title')}</h3>
        <p className="text-muted-foreground text-sm">{i18n.t('statement.mapping.description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{i18n.t('statement.mapping.encoding')}</Label>
          <Select value={encoding} onValueChange={setEncoding}>
            <SelectTrigger aria-label={i18n.t('statement.mapping.encoding')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENCODINGS.map((one) => (
                <SelectItem key={one} value={one}>
                  {one}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{i18n.t('statement.mapping.delimiter')}</Label>
          <Select value={delimiter} onValueChange={setDelimiter}>
            <SelectTrigger aria-label={i18n.t('statement.mapping.delimiter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIMITERS.map((one) => (
                <SelectItem key={one.value} value={one.value}>
                  {i18n.t(`statement.mapping.${one.label}` as 'statement.mapping.delimiter_comma')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-sm">{i18n.t('statement.mapping.header_hint')}</p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableBody>
              {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                <TableRow
                  key={index}
                  onClick={() => setHeaderAt(headerAt === index ? null : index)}
                  className={cn('cursor-pointer', headerAt === index && 'bg-muted font-medium')}
                  data-testid={`preview-row-${index}`}
                >
                  {Array.from({ length: columnCount }, (_, column) => (
                    <TableCell key={column} className="whitespace-nowrap text-xs">
                      {String(row[column] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {headerAt === null && (
          <p className="text-muted-foreground text-xs">{i18n.t('statement.mapping.no_header')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {columnSelect('date', i18n.t('statement.mapping.date'))}

        <div className="flex flex-col gap-1.5">
          <Label>{i18n.t('statement.mapping.date_format')}</Label>
          <Select value={dateFormat} onValueChange={(value) => setDateFormat(value as DateFormat)}>
            <SelectTrigger aria-label={i18n.t('statement.mapping.date_format')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((one) => (
                <SelectItem key={one} value={one}>
                  {one}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {columnSelect('description', i18n.t('statement.mapping.description_column'))}

        {(['currency', 'counterparty'] as OptionalField[]).map((field) => (
          <div key={field}>
            {columnSelect(
              field,
              i18n.t(
                field === 'currency'
                  ? 'statement.mapping.currency_column'
                  : 'statement.mapping.counterparty'
              ),
              { optional: true }
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={split} onCheckedChange={(value) => setSplit(value === true)} />
        {i18n.t('statement.mapping.split_amounts')}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {split ? (
          <>
            {columnSelect('debit', i18n.t('statement.mapping.debit'), { optional: true })}
            {columnSelect('credit', i18n.t('statement.mapping.credit'), { optional: true })}
          </>
        ) : (
          columnSelect('amount', i18n.t('statement.mapping.amount'))
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mapping-name">{i18n.t('statement.mapping.name')}</Label>
        <Input
          id="mapping-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={i18n.t('statement.mapping.name_placeholder')}
        />
      </div>

      <p className="text-muted-foreground text-sm" data-testid="mapping-reads">
        {draft && wouldRead
          ? i18n.t('statement.mapping.reads', { count: wouldRead })
          : i18n.t('statement.mapping.reads_none')}
      </p>

      <Button type="button" onClick={() => void save()} disabled={!draft?.name || !wouldRead || saving}>
        {i18n.t('statement.mapping.save')}
      </Button>
    </div>
  );
};

export default StatementMapping;
