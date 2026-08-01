import { TOTAL } from '@/constant.ts';
import { cn } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/formats.ts';
import type { Currency } from '@/constant.ts';

type MoneyCellProps = {
  id: string;
  price: number;
  currency: Currency;
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

export default function MoneyCell({ id, price, currency, directional }: MoneyCellProps) {
  if (!currency) {
    return null;
  }

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
      {formatMoney(price, currency, 'pl')}
    </p>
  );
}
