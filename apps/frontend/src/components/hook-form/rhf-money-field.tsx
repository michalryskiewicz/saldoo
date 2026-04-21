import { useFormContext, useWatch } from 'react-hook-form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
  InputGroupText,
} from '@/components/ui/input-group';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '../ui/form';
import * as React from 'react';
import type { Currency } from '@/constant.ts';
import { transformValue, transformValueOnBlur, transformValueOnChange } from '@/lib/utils.ts';

export type RHFMoneyFieldProps = React.ComponentProps<'input'> & {
  helperText?: string;
  description?: string;
  name: string;
  label: string;
  currencyField?: string;
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  PLN: 'zł',
};

export function RHFMoneyField({
  name,
  label,
  helperText,
  description,
  currencyField,
  ...other
}: RHFMoneyFieldProps) {
  const { control, setValue } = useFormContext();
  const formWatch = useWatch();
  const currency = currencyField ? (formWatch[currencyField] as Currency) : null;

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
              <InputGroup>
                {currency && (
                  <InputGroupAddon>
                    <InputGroupText>{CURRENCY_SYMBOL[currency]}</InputGroupText>
                  </InputGroupAddon>
                )}
                <InputGroupInput
                  {...field}
                  value={transformValue(field.value)}
                  onChange={(event) => {
                    const transformedValue = transformValueOnChange(event.target.value);
                    field.onChange(transformedValue);
                  }}
                  onBlur={(event) => {
                    const transformedValue = transformValueOnBlur(event.target.value);
                    field.onChange(transformedValue);
                  }}
                  type="number"
                  inputMode={'decimal'}
                  pattern={'[0-9]*\\.?[0-9]*'}
                  {...other}
                />
                {currency && currencyField && (
                  <InputGroupAddon align="inline-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <InputGroupButton variant="ghost" className="!pr-1.5 text-xs">
                          {currency}
                        </InputGroupButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="[--radius:0.95rem]">
                        {Object.keys(CURRENCY_SYMBOL).map((symbol) => {
                          return (
                            <DropdownMenuItem
                              key={symbol}
                              onClick={() => {
                                setValue(currencyField, symbol);
                              }}
                            >
                              {symbol}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </FormControl>
            {helperText && <FormDescription>{helperText}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
