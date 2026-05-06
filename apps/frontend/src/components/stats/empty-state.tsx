import type { ComponentType, ReactNode } from 'react';
import { Inbox, type LucideProps } from 'lucide-react';
import { Link } from 'react-router';

import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';

type EmptyStateProps = {
  icon?: ComponentType<LucideProps>;
  description: ReactNode;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
  size?: 'sm' | 'md';
};

export const EmptyState = ({
  icon: Icon = Inbox,
  description,
  ctaLabel,
  ctaTo,
  className,
  size = 'md',
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3',
        size === 'sm' ? 'py-4' : 'py-8',
        className
      )}
    >
      <div className="flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[28ch]">{description}</p>
      {ctaLabel && ctaTo && (
        <Button asChild size="sm" variant="outline">
          <Link to={ctaTo}>{ctaLabel}</Link>
        </Button>
      )}
    </div>
  );
};

type ChartEmptyOverlayProps = {
  description: ReactNode;
  icon?: ComponentType<LucideProps>;
  ctaLabel?: string;
  ctaTo?: string;
};

export const ChartEmptyOverlay = ({
  description,
  icon,
  ctaLabel,
  ctaTo,
}: ChartEmptyOverlayProps) => {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-[1px] rounded-md">
      <EmptyState
        icon={icon}
        description={description}
        ctaLabel={ctaLabel}
        ctaTo={ctaTo}
        size="sm"
      />
    </div>
  );
};
