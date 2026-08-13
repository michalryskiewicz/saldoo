import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { cn } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/formats.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';
import type { AllocationPart } from '@/features/net-worth/services/allocation.service.ts';

/**
 * How far a kind is from where it was meant to be, in words rather than a signed number.
 *
 * "−15" needs the reader to know which way the sign points and what the unit is. Percentage points
 * against per cent is exactly the confusion worth spelling out, since both are on the row.
 */
const drift = (part: AllocationPart): string | undefined => {
  if (part.drift === undefined) return undefined;
  if (part.drift === 0) return i18n.t('holdings.allocation.on_target');

  return i18n.t(part.drift > 0 ? 'holdings.allocation.over' : 'holdings.allocation.under', {
    points: Math.abs(part.drift),
  });
};

/**
 * What somebody's wealth is made of, and how far that is from what they planned.
 *
 * A table rather than a chart: the four figures on a row — amount, share, target, distance — are what
 * the reading is, and a ring would show one of them and hide the rest behind a hover.
 */
export const AllocationTable = () => {
  const { allocation, currency } = useNetWorth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('holdings.allocation.title')}</CardTitle>
        <CardDescription>{i18n.t('holdings.allocation.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        {allocation.parts.length ? (
          <table className="w-full text-sm" data-slot="allocation">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="py-1 text-left font-medium">{i18n.t('holdings.asset_type')}</th>
                <th className="py-1 text-right font-medium">{i18n.t('holdings.value')}</th>
                <th className="py-1 text-right font-medium">
                  {i18n.t('holdings.allocation.share')}
                </th>
                <th className="py-1 text-right font-medium">
                  {i18n.t('holdings.allocation.target')}
                </th>
                <th className="py-1 text-right font-medium">
                  {i18n.t('holdings.allocation.drift')}
                </th>
              </tr>
            </thead>
            <tbody>
              {allocation.parts.map((part) => (
                <tr key={part.assetType} data-slot={`allocation-${part.assetType}`}>
                  <td className="py-1">
                    {i18n.t(`holdings.type.${part.assetType}` as TranslationKey)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(part.value, currency, 'pl')}
                  </td>
                  <td className="py-1 text-right tabular-nums">{part.share}%</td>
                  <td className="text-muted-foreground py-1 text-right tabular-nums">
                    {part.target === undefined ? '—' : `${part.target}%`}
                  </td>
                  {/* Colour would say "wrong", and being away from a target is not wrong — it is a
                      fact somebody may have chosen. The words carry it instead. */}
                  <td className="text-muted-foreground py-1 text-right">{drift(part) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground text-sm">{i18n.t('holdings.allocation.empty')}</p>
        )}

        {/* Said out loud rather than folded into the shares: counted in, every kind would read as far
            below its target for a reason that is bookkeeping rather than a position. */}
        {allocation.untyped > 0 && (
          <p
            className={cn('text-muted-foreground text-xs', allocation.parts.length && 'mt-3')}
            data-slot="allocation-untyped"
          >
            {i18n.t('holdings.allocation.untyped', {
              amount: formatMoney(allocation.untyped, currency, 'pl'),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
