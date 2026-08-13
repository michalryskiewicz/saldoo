import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db } from '@/database';
import { updateDBPosition } from '@/database/positions.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { formatDate, formatMoney } from '@/lib/formats.ts';
import { toISODate } from '@/lib/dates.ts';
import i18n from '@/i18n.ts';
import {
  asksForUnitPrice,
  revaluationsFrom,
} from '@/features/net-worth/services/revaluation.service.ts';

/**
 * Saying what everything is worth, in one pass.
 *
 * Typing figures in by hand is not the tiring part of valuing holdings yourself — opening a drawer,
 * finding the field, saving and closing it, once per holding, is. So every holding is a row, and the
 * whole pass shares one date: a re-valuation is somebody saying what these are worth *today*, and
 * asking the date five times is asking the same question five times.
 *
 * Only what is held. A mortgage does not get re-valued by looking it up; its balance comes from a
 * statement, and it keeps the drawer it always had.
 *
 * Each row asks the question its holding is answered in — the price of one for anything counted, the
 * total for everything else — which is `asksForUnitPrice` rather than a rule repeated here.
 */
export const RevalueHoldings = () => {
  const positions = useLiveQuery(() => db.positions.toArray(), []) || [];
  const held = positions.filter((position) => position.kind === 'asset');

  const [asAt, setAsAt] = useState(() => toISODate(new Date()));
  const [entered, setEntered] = useState<Record<string, number | undefined>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const changes = revaluationsFrom(held, entered, new Date(asAt));

    if (!changes.length) {
      toast(i18n.t('holdings.revalue.nothing_to_do'));
      return;
    }

    setSaving(true);

    // One write per holding, through the same path the drawer uses — so the valuation history is
    // filed the same way whichever screen the figure was typed on.
    for (const change of changes) {
      const position = held.find((one) => one.id === change.positionId);
      if (!position) continue;

      await updateDBPosition(change.positionId, {
        ...position,
        value: change.value,
        unitPrice: change.unitPrice ?? position.unitPrice,
        valuedOn: change.valuedOn,
      });
    }

    setSaving(false);
    setEntered({});
    toast(i18n.t('holdings.revalue.saved', { count: changes.length }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{i18n.t('holdings.revalue.title')}</CardTitle>
        <CardDescription>{i18n.t('holdings.revalue.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {held.length ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="revalue-as-at">{i18n.t('holdings.revalue.as_of')}</Label>
              <Input
                id="revalue-as-at"
                type="date"
                value={asAt}
                onChange={(event) => setAsAt(event.target.value)}
                className="w-fit"
              />
            </div>

            <ul className="flex flex-col gap-3" data-slot="revalue-rows">
              {held.map((position) => {
                const perUnit = asksForUnitPrice(position);
                const field = `revalue-${position.id}`;

                return (
                  <li
                    key={position.id}
                    className="flex flex-wrap items-end justify-between gap-3"
                    data-slot={`revalue-${position.id}`}
                  >
                    <div className="flex flex-col">
                      <span>{position.description}</span>
                      {/* How old the figure is, on the row where it is replaced: a value nobody has
                          looked at since May is the one worth typing over first. */}
                      <span className="text-muted-foreground text-xs">
                        {i18n.t('holdings.revalue.current')}:{' '}
                        {formatMoney(position.value, position.currency, 'pl')} ·{' '}
                        {formatDate(position.valuedOn)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={field} className="text-xs">
                        {perUnit
                          ? `${i18n.t('holdings.revalue.new_unit_price')} ${i18n.t('holdings.revalue.per_unit_note', { units: position.units })}`
                          : i18n.t('holdings.revalue.new')}
                      </Label>
                      <Input
                        id={field}
                        type="number"
                        step="any"
                        value={entered[position.id] ?? ''}
                        onChange={(event) =>
                          setEntered((current) => ({
                            ...current,
                            // Emptied means "leave this one alone", which is not the same as nought.
                            [position.id]:
                              event.target.value === '' ? undefined : Number(event.target.value),
                          }))
                        }
                        className="w-40"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button onClick={save} disabled={saving} className="w-fit">
              {i18n.t('holdings.revalue.submit')}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{i18n.t('holdings.revalue.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
};
