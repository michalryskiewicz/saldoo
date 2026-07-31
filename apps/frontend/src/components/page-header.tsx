import type { ReactNode } from 'react';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item.tsx';

type PageHeaderProps = {
  title: string;
  description?: string;
  /** The screen's primary action, if it has one. */
  children?: ReactNode;
};

/**
 * The title block every list screen opens with.
 *
 * Extracted because three pages carried it character for character, which is three places to
 * miss when the heading scale changes.
 */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <Item className="px-0">
      <ItemContent>
        <ItemTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">{title}</ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
      </ItemContent>
      {children && <ItemActions>{children}</ItemActions>}
    </Item>
  );
}
