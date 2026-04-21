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
    <p className={cn('text-right max-w-20 ', { 'font-bold': id === TOTAL })}>
      {formatMoney(price, currency, 'pl')}
    </p>
  );
}
