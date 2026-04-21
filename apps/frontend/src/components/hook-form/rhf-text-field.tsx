import { useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '../ui/form';
import { Input } from '@/components/ui/input.tsx';
import * as React from 'react';
import { transformValue, transformValueOnBlur, transformValueOnChange } from '@/lib/utils.ts';

export type RHFTextFieldProps = React.ComponentProps<'input'> & {
  helperText?: string;
  description?: string;
  name: string;
  label: string;
};

export function RHFTextField({
  name,
  label,
  helperText,
  description,
  type = 'text',
  ...other
}: RHFTextFieldProps) {
  const { control } = useFormContext();

  const isNumberType = type === 'number';

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => {
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {description && <FormLabel>{description}</FormLabel>}
            <FormControl>
              <Input
                {...field}
                value={isNumberType ? transformValue(field.value) : field.value}
                onChange={(event) => {
                  const transformedValue = isNumberType
                    ? transformValueOnChange(event.target.value)
                    : event.target.value;

                  field.onChange(transformedValue);
                }}
                onBlur={(event) => {
                  const transformedValue = isNumberType
                    ? transformValueOnBlur(event.target.value)
                    : event.target.value;

                  field.onChange(transformedValue);
                }}
                type={isNumberType ? 'text' : type}
                inputMode={isNumberType ? 'decimal' : undefined}
                pattern={isNumberType ? '[0-9]*\\.?[0-9]*' : undefined}
                {...other}
              />
            </FormControl>
            {helperText && <FormDescription>{helperText}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
