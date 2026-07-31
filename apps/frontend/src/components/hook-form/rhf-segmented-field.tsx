import type { CSSProperties } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils.ts';

export type SegmentedOption = {
  label: string;
  value: string;
  /**
   * The colour this choice means, if it means one — a CSS colour or a `var(...)`, filled into the
   * segment once selected.
   *
   * It has to be a colour picked to carry text: the severity fills are, because the table's chips
   * already write on exactly these, which is what makes a selected "Wysoki" look like the "Wysoki"
   * in a row rather than merely being spelled the same.
   */
  color?: string;
};

type RHFSegmentedFieldProps = {
  name: string;
  label?: string;
  options: SegmentedOption[];
  helperText?: string;
};

/**
 * A short, closed set of choices, all of them visible.
 *
 * For three or four options a select is the wrong instrument: it hides the rest behind a click,
 * costs two clicks to answer instead of one, and says nothing about what the choice is until it is
 * opened.
 *
 * Built on Radix's radio group rather than on buttons, which is the reason it is worth a component
 * at all: a row of buttons needs `role`, `aria-checked`, tab management and arrow-key movement
 * wired by hand, and would get some of it wrong. Here it is a radio group because that is what it
 * is, and the arrow keys already work.
 *
 * Controlled rather than `defaultValue`: Radix reads that once and then keeps its own selection, so
 * a form whose value changes underneath it — a reset, or defaults arriving after the first render —
 * would leave the buttons showing one thing and the form holding another.
 */
export const RHFSegmentedField = ({
  name,
  label,
  options,
  helperText,
}: RHFSegmentedFieldProps) => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <RadioGroupPrimitive.Root
              value={field.value ?? ''}
              onValueChange={field.onChange}
              // Equal columns and allowed to wrap: four parts fit a drawer in one row, and the
              // labels are words of unequal length that must not change the buttons' widths.
              className="bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-md p-1"
            >
              {options.map((option) => (
                <RadioGroupPrimitive.Item
                  key={option.value}
                  value={option.value}
                  // The colour travels as a custom property so the class below can stay static.
                  style={
                    option.color ? ({ '--segment': option.color } as CSSProperties) : undefined
                  }
                  className={cn(
                    'text-muted-foreground rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                    'hover:text-foreground focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                    option.color
                      ? 'data-[state=checked]:bg-(--segment) data-[state=checked]:text-(--severity-fill-foreground)'
                      : 'data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-xs'
                  )}
                >
                  {option.label}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
          </FormControl>
          {helperText && <FormDescription>{helperText}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
