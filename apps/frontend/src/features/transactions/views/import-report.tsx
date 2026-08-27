import { toast } from 'sonner';
import i18n from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import {
  needsAttention,
  reportAsText,
  rowsSeen,
  type ImportReport,
} from '@/features/transactions/services/import-report.service.ts';

/**
 * What one upload did, said in full and on the screen that did it.
 *
 * A toast saying "imported" is the wrong shape for this: a statement is loaded once a month, half
 * the rows are usually ones we already hold, and "132 imported" out of a file of 140 is a question
 * — not an answer. Every line here exists so nobody has to count rows themselves.
 *
 * **Duplicates are stated plainly and not apologised for.** They are what re-uploading a month is
 * supposed to produce, and dressing them up as a problem is how a report becomes something people
 * dismiss without reading.
 */
export const ImportReportPanel = ({
  report,
  bank,
  fileName,
}: {
  report: ImportReport;
  bank: string;
  fileName: string;
}) => {
  const text = reportAsText(report, { bank, fileName });

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast(i18n.t('statement.report.copied'));
  };

  /**
   * Written to a blob and clicked, because the report is about somebody's own file and must not
   * take a trip through anything of ours to be saved.
   */
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = `saldoo-import-${fileName.replace(/\.csv$/i, '')}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md border p-3', needsAttention(report) && 'border-destructive')}
      data-testid="import-report"
    >
      <p className="text-sm font-medium">{i18n.t('statement.report.title')}</p>

      <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
        <li>{i18n.t('statement.report.imported', { count: report.imported })}</li>
        {report.duplicates > 0 && (
          <li>{i18n.t('statement.report.duplicates', { count: report.duplicates })}</li>
        )}
        {report.repeatedInFile > 0 && (
          <li>{i18n.t('statement.report.repeated', { count: report.repeatedInFile })}</li>
        )}
        {report.unreadable.length > 0 && (
          <li>{i18n.t('statement.report.unreadable', { count: report.unreadable.length })}</li>
        )}
        {report.notStored > 0 && (
          <li className="text-destructive">
            {i18n.t('statement.report.not_stored', { count: report.notStored })}
          </li>
        )}
        {report.from && report.to && (
          <li>{i18n.t('statement.report.covering', { from: report.from, to: report.to })}</li>
        )}
      </ul>

      {report.unreadable.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          {report.unreadable.map((warning) => (
            <li key={`${warning.row}-${warning.reason}`}>
              {i18n.t('statement.report.row', { row: warning.row })} —{' '}
              {i18n.t(
                warning.reason === 'no-date'
                  ? 'statement.report.reason_no-date'
                  : 'statement.report.reason_unreadable-amount'
              )}
            </li>
          ))}
        </ul>
      )}

      {rowsSeen(report) > report.imported && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            {i18n.t('statement.report.copy')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={download}>
            {i18n.t('statement.report.download')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImportReportPanel;
