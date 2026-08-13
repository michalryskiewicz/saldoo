import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { formatMoney } from '@/lib/formats.ts';
import i18n, { type TranslationKey } from '@/i18n.ts';
import { useNetWorth } from '@/features/net-worth/hooks/use-net-worth.tsx';
import {
  untypedShare,
  type AllocationPart,
} from '@/features/net-worth/services/allocation.service.ts';

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
  const untyped = untypedShare(allocation);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('holdings.allocation.title')}</CardTitle>
        <CardDescription>{i18n.t('holdings.allocation.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* First, not last. Seen on a real account: bonds at 5 544 € reported as "100%" beside
            69 122 € under no type — every figure true, and the screen reading as though the app were
            broken. The share of a split means nothing until the reader knows what it is a split *of*. */}
        {untyped > 0 && (
          <p className="text-warning text-sm" data-slot="allocation-untyped">
            {i18n.t('holdings.allocation.untyped_leads', {
              amount: formatMoney(allocation.untyped, currency, 'pl'),
              share: untyped,
              typed: 100 - untyped,
            })}
          </p>
        )}

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
      </CardContent>
    </Card>
  );
};
