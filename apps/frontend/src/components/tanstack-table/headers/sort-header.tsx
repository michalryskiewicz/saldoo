import i18n, { type TranslationKey } from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { ArrowUpDown } from 'lucide-react';
import type { Column } from '@tanstack/react-table';

type SortHeaderProps<T extends Record<string, unknown>> = {
  header: TranslationKey;
  column: Column<T>;
};

export default function SortHeader<T extends Record<string, unknown>>({
  header,
  column,
}: SortHeaderProps<T>) {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        column.toggleSorting(column.getIsSorted() === 'asc');
      }}
    >
      {i18n.t(header)}

      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}
