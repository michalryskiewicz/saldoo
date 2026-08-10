import { TOTAL } from '@/constant.ts';
import { cn } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/formats.ts';
import i18n from '@/i18n.ts';
import type { Currency } from '@/constant.ts';
import type { ConvertedFrom } from '@/lib/exchange-rate.ts';

type MoneyCellProps = {
  id: string;
  price: number;
  currency: Currency;
  /**
   * What this figure was before it was converted — absent where it was not.
   *
   * Marked on the figure rather than claimed in the column heading, which is where this used to
   * live: a heading speaks for every row, and on a mixed table most rows were never converted, so
   * the claim was false for them. The original travels with the mark, because a rate nobody was
   * shown is a rate nobody can check.
   */
  convertedFrom?: ConvertedFrom;
  /**
   * That this column's figures carry a direction — money arriving as well as money leaving.
   *
   * Only the ledger does. Everywhere else a figure is a cost and every row points the same way,
   * so nothing has to be told apart. Where both directions share one column, a minus sign is a
   * single character to spot in a page of digits, so money arriving is tinted as well as signed.
   *
   * This is the one place colour says something other than urgency in this app, and it may not
   * say two things at once: no column shows a direction and a priority in the same figure.
   */
  directional?: boolean;
};

export default function MoneyCell({
  id,
  price,
  currency,
  directional,
  convertedFrom,
}: MoneyCellProps) {
  if (!currency) {
    return null;
  }

  const cameFrom =
    convertedFrom &&
    i18n.t('converted_from', {
      amount: formatMoney(convertedFrom.amount, convertedFrom.currency, 'pl'),
    });

  return (
    // `tabular-nums` so a column of figures lines up on the decimal. Alignment is declared on
    // the column, so the heading above cannot disagree with it.
    <p
      // Named on the summary row so a test can ask for the figure rather than counting columns:
      // a table may hold more than one money column, and then "the second cell" is a guess.
      data-slot={id === TOTAL ? 'summary-figure' : undefined}
      className={cn('tabular-nums whitespace-nowrap', {
        'font-bold': id === TOTAL,
        'text-positive': directional && price > 0,
      })}
    >
      {cameFrom && (
        <span data-slot="converted" title={cameFrom} className="text-muted-foreground cursor-help">
          {/* The glyph carries nothing for a reader who cannot see it, and the sentence carries
              nothing for one who can — so each gets the one that says something to them. */}
          <span aria-hidden="true">≈ </span>
          <span className="sr-only">{cameFrom}</span>
        </span>
      )}
      {formatMoney(price, currency, 'pl')}
    </p>
  );
}
