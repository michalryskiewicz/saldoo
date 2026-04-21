import { useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '../ui/form';
import * as React from 'react';
import { InputTags } from '@/components/ui/input-tag.tsx';
import { cn } from '@/lib/utils.ts';

export type RHFTagsInputProps = React.ComponentProps<'input'> & {
  helperText?: string;
  description?: string;
  name: string;
  label: string;
  fullWidth?: boolean;
  placeholder?: string;
};

export function RHFTagsInput({
  name,
  label,
  helperText,
  description,
  fullWidth,
  placeholder,
}: RHFTagsInputProps) {
  const { control } = useFormContext();

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl className={cn(fullWidth && 'w-full')}>
            {/* Adapt RHF field to InputTags API */}
            <InputTags
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={Array.isArray(field.value) ? (field.value as string[]) : []}
              onChange={(updater) => {
                const prev = Array.isArray(field.value) ? (field.value as string[]) : [];
                const next =
                  typeof updater === 'function'
                    ? (updater as (s: string[]) => string[])(prev)
                    : updater;
                const normalized = Array.from(
                  new Set(
                    (next ?? []).map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
                  )
                );
                field.onChange(normalized);
              }}
              placeholder={placeholder}
              className={cn(fullWidth ? undefined : 'max-w-[500px]')}
            />
          </FormControl>
          {helperText && <FormDescription>{helperText}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
