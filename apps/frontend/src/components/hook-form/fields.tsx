import { RHFTextField } from './rhf-text-field.tsx';
import { RHFDateRangePickerField } from '@/components/hook-form/rhf-date-range-picker-field.tsx';
import { RHFSelect } from '@/components/hook-form/rhf-select.tsx';
import { RHFTagsInput } from '@/components/hook-form/rhf-tags-input.tsx';
import { RHFRadioGroup } from '@/components/hook-form/rhf-radio-group.tsx';
import { RHFAutoComplete } from '@/components/hook-form/rhf-auto-complete.tsx';
import { RHFMoneyField } from '@/components/hook-form/rhf-money-field.tsx';
import { RHFSegmentedField } from '@/components/hook-form/rhf-segmented-field.tsx';

export const Field = {
  Text: RHFTextField,
  Date: RHFDateRangePickerField,
  Select: RHFSelect,
  Tags: RHFTagsInput,
  RadioGroup: RHFRadioGroup,
  AutoComplete: RHFAutoComplete,
  Money: RHFMoneyField,
  Segmented: RHFSegmentedField,
};
