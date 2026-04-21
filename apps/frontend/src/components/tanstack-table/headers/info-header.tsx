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
    <div className="flex flex-row gap-0.5 justify-start items-center">
      {i18n.t(header)}

      <InfoTooltip text={i18n.t(tooltip)} />
    </div>
  );
}
