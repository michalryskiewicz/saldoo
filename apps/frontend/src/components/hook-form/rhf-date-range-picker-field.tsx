import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar.tsx';
import { formatDate } from '@/lib/formats.ts';
import { pl } from 'react-day-picker/locale';

export type RHFDateRangePickerFieldProps = {
  helperText?: string;
  description?: string;
  name: string;
  label: string;
  disableFuture?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
};

export function RHFDateRangePickerField({
  name,
  label,
  helperText,
  disableFuture,
  fullWidth,
  placeholder,
}: RHFDateRangePickerFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          {label && <FormLabel>{label}</FormLabel>}
          <Popover>
            <PopoverTrigger asChild>
              <FormControl className={cn(fullWidth && 'w-full')}>
                <Button
                  variant="outline"
                  className={cn(
                    ' pl-3 text-left font-normal',
                    !field.value && 'text-muted-foreground',
                    fullWidth ? undefined : 'w-[240px]'
                  )}
                >
                  {field.value ? (
                    formatDate(field.value)
                  ) : (
                    <span className="text-ellipsis overflow-hidden whitespace-nowrap w-full">
                      {placeholder}
                    </span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                locale={pl}
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={(date) => {
                  if (disableFuture) {
                    return date > new Date() || date < new Date('1900-01-01');
                  }

                  return date < new Date('1900-01-01');
                }}
              />
            </PopoverContent>
          </Popover>
          {helperText && <FormDescription>{helperText}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
