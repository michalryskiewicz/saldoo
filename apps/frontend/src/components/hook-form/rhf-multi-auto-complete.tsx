import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFormContext } from 'react-hook-form';

type RHFMultiAutoCompleteProps = {
  name: string;
  label?: string;
  options: { label: string; value: string }[];
  helperText?: string;
  emptyText?: string;
  description?: string;
  placeholder?: string;
  noneSelectedText: string;
};

/**
 * Several of a closed set of choices, held as an array of values.
 *
 * The single-choice sibling cannot stand in for this. A flat-rate tax is a share of *the invoices*,
 * plural: somebody with three clients pays one tax, and a field that took one income would make
 * them enter the same tax three times and then keep three copies of it in step by hand.
 *
 * The list stays open on a click, because the point of the control is picking more than one — and
 * every selection is spelled out in the trigger rather than counted, since "3 wybrane" tells the
 * reader nothing about *which* three and this is a field whose value changes a figure.
 */
export const RHFMultiAutoComplete = ({
  name,
  label,
  options,
  helperText,
  emptyText,
  description,
  placeholder,
  noneSelectedText,
}: RHFMultiAutoCompleteProps) => {
  const { control, setValue } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : [];
        const toggle = (value: string) =>
          setValue(
            name,
            selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
            { shouldValidate: true }
          );

        return (
          <FormItem className="flex flex-col">
            {label && <FormLabel>{label}</FormLabel>}
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between text-left font-normal',
                      !selected.length && 'text-muted-foreground'
                    )}
                  >
                    <span className="truncate">
                      {selected.length
                        ? options
                            .filter((o) => selected.includes(o.value))
                            .map((o) => o.label)
                            .join(', ')
                        : noneSelectedText}
                    </span>
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder={placeholder} className="h-9" />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      {options.map((option) => (
                        <CommandItem
                          value={option.label}
                          key={option.value}
                          onSelect={() => toggle(option.value)}
                        >
                          {option.label}
                          <Check
                            className={cn(
                              'ml-auto',
                              selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {helperText && <FormDescription>{helperText}</FormDescription>}
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
