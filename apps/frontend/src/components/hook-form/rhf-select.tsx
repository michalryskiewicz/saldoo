import { useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils.ts';
import { InfoTooltip } from '@/components/info-tooltip.tsx';

export type RHFSelectProps = {
  helperText?: string;
  description?: string;
  placeholder?: string;
  name: string;
  label: string;
  options: { label: string; value: string }[];
  fullWidth?: boolean;
  infoTooltip?: string;
  /** For a select whose meaning comes from what sits beside it rather than from a label. */
  ariaLabel?: string;
};

export function RHFSelect({
  name,
  label,
  helperText,
  options,
  placeholder,
  fullWidth,
  infoTooltip,
  ariaLabel,
}: RHFSelectProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && (
            <FormLabel>
              {label}
              {infoTooltip && <InfoTooltip text={infoTooltip} />}
            </FormLabel>
          )}
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl className={cn(fullWidth && 'w-full')}>
              <SelectTrigger aria-label={ariaLabel}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {helperText && <FormDescription>{helperText}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
