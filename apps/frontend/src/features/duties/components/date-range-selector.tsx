import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { Calendar } from '@/components/ui/calendar.tsx';
import { capitalize } from '@/lib/strings.ts';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';

export type DateRange = { from: Date; to: Date };

type DateRangeSelectorProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
};

const monthRange = (anchor: Date): DateRange => ({
  from: startOfMonth(anchor),
  to: endOfMonth(anchor),
});

const matchesMonth = (range: DateRange, anchor: Date) => {
  return (
    isSameDay(range.from, startOfMonth(anchor)) && isSameDay(range.to, endOfMonth(anchor))
  );
};

const formatLabel = (range: DateRange) => {
  if (matchesMonth(range, range.from)) {
    return capitalize(format(range.from, 'LLLL yyyy', { locale: pl }));
  }
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const fromStr = format(range.from, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: pl });
  const toStr = format(range.to, 'd MMM yyyy', { locale: pl });
  return `${fromStr} – ${toStr}`;
};

const optionItemClass =
  'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default select-none outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[active=true]:font-medium';

export default function DateRangeSelector({
  value,
  onChange,
  className,
}: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'custom'>('list');
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({
    from: value.from,
    to: value.to,
  });

  const today = useMemo(() => new Date(), []);
  const previousMonthRange = useMemo(() => monthRange(subMonths(today, 1)), [today]);
  const thisMonthRange = useMemo(() => monthRange(today), [today]);
  const nextMonthRange = useMemo(() => monthRange(addMonths(today, 1)), [today]);

  const isCustom = !matchesMonth(value, value.from);
  const activeOption: 'previous' | 'current' | 'next' | 'custom' = isCustom
    ? 'custom'
    : matchesMonth(value, today)
      ? 'current'
      : matchesMonth(value, subMonths(today, 1))
        ? 'previous'
        : matchesMonth(value, addMonths(today, 1))
          ? 'next'
          : 'custom';

  const handleSelect = (next: DateRange) => {
    onChange(next);
    setOpen(false);
    setView('list');
  };

  const stepMonth = (delta: number) => {
    const anchor = isCustom ? today : value.from;
    onChange(monthRange(addMonths(anchor, delta)));
  };

  const applyCustom = () => {
    if (!draftRange.from || !draftRange.to) return;
    const from = startOfDay(draftRange.from);
    const to = endOfDay(draftRange.to);
    onChange(from <= to ? { from, to } : { from: to, to: from });
    setOpen(false);
    setView('list');
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={i18n.t('date_range.previous_month_aria')}
        onClick={() => stepMonth(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setView('list');
          if (o) setDraftRange({ from: value.from, to: value.to });
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-slot="select-trigger"
            data-size="default"
            aria-label={i18n.t('date_range.open_aria')}
            className="border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex w-[180px] items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <span className="line-clamp-1">{formatLabel(value)}</span>
            <ChevronDown className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn('p-1', view === 'custom' ? 'w-auto' : 'w-[220px]')}
        >
          {view === 'list' ? (
            <div className="flex flex-col gap-0.5">
              <OptionRow
                label={i18n.t('previous_month')}
                hint={capitalize(format(previousMonthRange.from, 'LLL', { locale: pl }))}
                isActive={activeOption === 'previous'}
                onClick={() => handleSelect(previousMonthRange)}
              />
              <OptionRow
                label={i18n.t('this_month')}
                hint={capitalize(format(thisMonthRange.from, 'LLL', { locale: pl }))}
                isActive={activeOption === 'current'}
                onClick={() => handleSelect(thisMonthRange)}
              />
              <OptionRow
                label={i18n.t('next_month')}
                hint={capitalize(format(nextMonthRange.from, 'LLL', { locale: pl }))}
                isActive={activeOption === 'next'}
                onClick={() => handleSelect(nextMonthRange)}
              />
              <div className="my-1 h-px bg-border" />
              <OptionRow
                label={i18n.t('custom_range')}
                isActive={activeOption === 'custom'}
                onClick={() => setView('custom')}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-2">
              <Calendar
                // weekStartsOn=1 → poniedziałek
                weekStartsOn={1}
                locale={pl}
                mode="range"
                numberOfMonths={2}
                defaultMonth={draftRange.from ?? value.from}
                selected={
                  draftRange.from
                    ? { from: draftRange.from, to: draftRange.to }
                    : undefined
                }
                onSelect={(r) => {
                  const range = r as { from?: Date; to?: Date } | undefined;
                  setDraftRange({ from: range?.from, to: range?.to ?? range?.from });
                }}
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-1 text-xs text-muted-foreground">
                <span>
                  {i18n.t('date_range.from')}:{' '}
                  <span className="text-foreground">
                    {draftRange.from
                      ? format(draftRange.from, 'd MMM yyyy', { locale: pl })
                      : '—'}
                  </span>
                </span>
                <span>
                  {i18n.t('date_range.to')}:{' '}
                  <span className="text-foreground">
                    {draftRange.to ? format(draftRange.to, 'd MMM yyyy', { locale: pl }) : '—'}
                  </span>
                </span>
              </div>
              <div className="flex justify-end gap-2 px-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setView('list')}>
                  {i18n.t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftRange.from || !draftRange.to}
                  onClick={applyCustom}
                >
                  {i18n.t('date_range.apply')}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={i18n.t('date_range.next_month_aria')}
        onClick={() => stepMonth(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

type OptionRowProps = {
  label: string;
  hint?: string;
  isActive: boolean;
  onClick: () => void;
};

function OptionRow({ label, hint, isActive, onClick }: OptionRowProps) {
  return (
    <button type="button" className={optionItemClass} data-active={isActive} onClick={onClick}>
      <span className="flex size-4 items-center justify-center text-foreground">
        {isActive ? <Check className="size-3.5" aria-hidden="true" /> : null}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
