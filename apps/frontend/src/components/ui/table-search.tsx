import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.tsx';
import i18n from '@/i18n.ts';

type TableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * The one control above a table.
 *
 * It replaces two rows of filter pills. Those read as navigation rather than as filters, said
 * nothing about whether anything was active, and needed a new row of them for every column worth
 * narrowing by. A search box reaches every column at once — including the priority and the
 * recurrence, which are the two the pills used to cover.
 *
 * The clear button appears only once there is something to clear: a control that is permanently
 * disabled is a control that has to be read and then ignored.
 */
export function TableSearch({ value, onChange, placeholder }: TableSearchProps) {
  return (
    <InputGroup className="w-full sm:max-w-xs">
      <InputGroupAddon align="inline-start">
        <Search aria-hidden />
      </InputGroupAddon>

      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? i18n.t('table.search_placeholder')}
        aria-label={placeholder ?? i18n.t('table.search_placeholder')}
      />

      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => onChange('')}
            aria-label={i18n.t('table.clear_search')}
          >
            <X aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
