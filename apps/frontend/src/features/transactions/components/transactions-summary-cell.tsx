import { cn } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import type { TransactionsSummary } from '@/features/transactions/services/transactions-summary.service.ts';

type TransactionsSummaryCellProps = {
  summary: TransactionsSummary;
};

/**
 * What the visible payments come to, as the two figures they are.
 *
 * Labelled here rather than in the column beside it: one summary row cannot carry two labels in
 * a cell built to hold one, and an unlabelled pair of figures asks the reader to work out which
 * is which from their signs.
 */
export default function TransactionsSummaryCell({ summary }: TransactionsSummaryCellProps) {
  const { incoming, outgoing, currency } = summary;

  if (!currency) {
    return null;
  }

  const lines = [
    { label: i18n.t('money_in'), amount: incoming, arriving: true },
    { label: i18n.t('money_out'), amount: outgoing, arriving: false },
  ];

  return (
    <div className="flex flex-col items-end gap-0.5">
      {lines.map(({ label, amount, arriving }) => (
        <p key={label} className="flex items-baseline justify-end gap-2 whitespace-nowrap">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </span>
          <span className={cn('tabular-nums font-bold', { 'text-positive': arriving })}>
            {formatMoney(amount, currency, 'pl')}
          </span>
        </p>
      ))}
    </div>
  );
}
