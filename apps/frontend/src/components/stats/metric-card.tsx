'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: string;
  limit: string;
  percentage: number;
  status?: string;
  statusColor?: string;
  progressColor: string;
  details?: Array<{ label: string; value: string; color: string }>;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  warningMessage?: string;
  onActionClick?: () => void;
}

export function MetricCard({
  title,
  value,
  limit,
  percentage,
  status,
  statusColor = 'text-emerald-600 dark:text-emerald-400',
  progressColor,
  details,
  actionLabel,
  actionIcon,
  warningMessage,
  onActionClick,
}: MetricCardProps) {
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
            className="absolute left-0 h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${writesPercentage}%` }}
          />
          <div
            className="absolute h-full bg-blue-500 transition-all duration-300"
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
      <CardContent className="p-4 py-0">
        <h5 className="text-xs font-normal leading-none tracking-wide text-muted-foreground dark:text-foreground/80 uppercase">
          {title}
        </h5>

        <div className="mt-2 flex items-baseline gap-1">
          <div className="text-[1.2rem] font-medium leading-none text-foreground tabular-nums">
            {value}
          </div>
          <div className="text-xs leading-none text-muted-foreground">/ {limit}</div>
        </div>

        <div className="mt-3">
          {renderProgressBar()}

          {details && (
            <div className="my-2">
              <div className="flex flex-col gap-3">
                {details.map((detail, index) => (
                  <div
                    key={index}
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
              <div className="text-sm text-amber-700 dark:text-amber-400">{warningMessage}</div>
            </div>
          )}
        </div>

        {actionLabel && (
          <div className="absolute bottom-0 left-0 right-0">
            <Button
              variant="ghost"
              className="h-8 w-full rounded-none text-blue-500 gap-0 justify-start hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-muted/50"
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
