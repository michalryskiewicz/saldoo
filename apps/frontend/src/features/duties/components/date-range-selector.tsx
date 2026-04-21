import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import i18n from '@/i18n.ts';

export default function DateRangeSelector() {
  return (
    <Select value="this-month">
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select date range" />
      </SelectTrigger>
      <SelectContent defaultValue="this-month">
        <SelectItem value="this-month">{i18n.t('this_month')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
