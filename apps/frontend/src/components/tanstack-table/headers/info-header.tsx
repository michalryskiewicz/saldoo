import i18n, { type TranslationKey } from '@/i18n.ts';
import type { Column } from '@tanstack/react-table';
import { InfoTooltip } from '@/components/info-tooltip.tsx';

type InfoHeaderProps<T extends Record<string, unknown>> = {
  header: TranslationKey;
  column: Column<T>;
  tooltip: TranslationKey;
};

export default function InfoHeader<T extends Record<string, unknown>>({
  header,
  tooltip,
}: InfoHeaderProps<T>) {
  return (
    // `inline-flex`, so the column's own alignment positions this box. As a block flex with
    // `justify-start` it sat left however the column was aligned, which is how a right-aligned
    // money column ended up with a left-aligned heading.
    <div className="inline-flex flex-row items-center gap-0.5">
      {i18n.t(header)}

      <InfoTooltip text={i18n.t(tooltip)} />
    </div>
  );
}
