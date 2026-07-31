import { TOTAL } from '@/constant.ts';
import { cn } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/formats.ts';
import type { Currency } from '@/constant.ts';

type MoneyCellProps = {
  id: string;
  price: number;
  currency: Currency;
};

export default function MoneyCell({ id, price, currency }: MoneyCellProps) {
  if (!currency) {
    return null;
  }

  return (
    // `tabular-nums` so a column of figures lines up on the decimal, and no `max-w`: five
    // rem could not hold "12 500,00 zł" and quietly wrapped the user's own money.
    <p className={cn('text-right tabular-nums whitespace-nowrap', { 'font-bold': id === TOTAL })}>
      {formatMoney(price, currency, 'pl')}
    </p>
  );
}
