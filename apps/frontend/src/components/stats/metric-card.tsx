'use client';

import type React from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { cn } from '@/lib/utils.ts';

interface MetricCardProps {
  title: string;
  value: string;
  limit: string;
  percentage: number;
  /** A sentence, or anything that says what this card means for the rest of the app. */
  status?: React.ReactNode;
  statusColor?: string;
  progressColor: string;
  details?: Array<{ label: string; value: string; color: string }>;
  actionLabel?: string;
  /**
   * What a screen reader should call this action, when the visible label is not enough.
   *
   * A grid of these cards puts the same word on every button — "Put aside", "Put aside", "Put
   * aside" — and a person listing the buttons hears no difference between them. The visible label
   * stays short because the card it sits in says which one it is; the accessible name has to carry
   * that itself.
   */
  actionName?: string;
  actionIcon?: React.ReactNode;
  warningMessage?: string;
  onActionClick?: () => void;
  isEmpty?: boolean;
  emptyDescription?: string;
  emptyIcon?: ComponentType<LucideProps>;
  emptyCtaLabel?: string;
  emptyCtaTo?: string;
}

export function MetricCard({
  title,
  value,
  limit,
  percentage,
  status,
  statusColor = 'text-positive',
  progressColor,
  details,
  actionLabel,
  actionName,
  actionIcon,
  warningMessage,
  onActionClick,
  isEmpty = false,
  emptyDescription,
  emptyIcon,
  emptyCtaLabel,
  emptyCtaTo,
}: MetricCardProps) {
  if (isEmpty) {
    return (
      <Card className="relative overflow-hidden w-full">
        <CardContent className="p-4 py-0">
          <h5 className="text-xs font-normal leading-none tracking-wide text-muted-foreground dark:text-foreground/80 uppercase">
            {title}
          </h5>
          <EmptyState
            icon={emptyIcon}
            description={emptyDescription ?? ''}
            ctaLabel={emptyCtaLabel}
            ctaTo={emptyCtaTo}
            size="sm"
          />
        </CardContent>
      </Card>
    );
  }

  const renderProgressBar = () => {
    if (details && title === 'Commands') {
      const writes = Number.parseInt(details[0].value.replace(/,/g, ''));
      const reads = Number.parseInt(details[1].value.replace(/,/g, ''));
      const total = writes + reads;
      const writesPercentage = (writes / total) * 100;
      const readsPercentage = (reads / total) * 100;

      return (
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute left-0 h-full bg-positive transition-all duration-300"
            style={{ width: `${writesPercentage}%` }}
          />
          <div
            className="absolute h-full bg-info transition-all duration-300"
            style={{
              left: `${writesPercentage}%`,
              width: `${readsPercentage}%`,
            }}
          />
        </div>
      );
    }

    return (
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden w-full">
      {/* Room for the action, which is laid over the bottom of the card rather than in the flow.
          Without it the last thing in the content sits underneath the button — visible, and not
          clickable, because the button takes the pointer. */}
      <CardContent className={cn('p-4 py-0', actionLabel && 'pb-10')}>
        <h5 className="text-xs font-normal leading-none tracking-wide text-muted-foreground dark:text-foreground/80 uppercase">
          {title}
        </h5>

        <div className="mt-2 flex items-baseline gap-1">
          <div
            data-slot="metric-value"
            className="text-[1.2rem] font-medium leading-none text-foreground tabular-nums"
          >
            {value}
          </div>
          <div
            data-slot="metric-limit"
            className="text-xs leading-none text-muted-foreground tabular-nums"
          >
            / {limit}
          </div>
        </div>

        <div className="mt-3">
          {renderProgressBar()}

          {details && (
            <div className="my-2">
              <div className="flex flex-col gap-3">
                {details.map((detail, index) => (
                  <div
                    key={index}
                    data-slot="metric-detail"
                    className="flex w-full items-center text-xs leading-none text-muted-foreground dark:text-foreground/70"
                  >
                    <div className={`mr-[6px] h-2 w-2 rounded-full ${detail.color}`} />
                    <div className="mr-1">{detail.label}</div>
                    <div className="h-[9px] flex-1 border-b-2 border-dotted border-border" />
                    <div className="ml-1 tabular-nums">{detail.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status && (
            <div className="pt-2">
              <div className={statusColor}>{status}</div>
            </div>
          )}

          {warningMessage && (
            <div className="pt-2">
              <div className="text-sm text-warning">{warningMessage}</div>
            </div>
          )}
        </div>

        {actionLabel && (
          <div className="absolute bottom-0 left-0 right-0">
            <Button
              variant="ghost"
              className="h-8 w-full rounded-none text-info gap-0 justify-start hover:brightness-110 bg-muted/50"
              aria-label={actionName}
              onClick={onActionClick}
            >
              {actionIcon}
              <span className="ml-1 text-xs">{actionLabel}</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
