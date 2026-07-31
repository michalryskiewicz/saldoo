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

type RHFSegmentedFieldProps = {
  name: string;
  label?: string;
  options: { label: string; value: string }[];
  helperText?: string;
};

/**
 * A short, closed set of choices, all of them visible.
 *
 * For three options a select is the wrong instrument: it hides two of the three behind a click,
 * costs two clicks to answer instead of one, and gives no sense of what the choice even is until
 * it is opened. Priority is the case in point — three values, one of them always right in front of
 * you.
 *
 * Built on Radix's radio group rather than on buttons, and that is the whole reason it is worth a
 * component: a row of buttons would need `role`, `aria-checked`, tab management and arrow-key
 * movement wired by hand, and would get some of it wrong. Here the semantics are a radio group
 * because that is what this is, and the arrow keys already work.
 *
 * Controlled, not `defaultValue`: Radix reads that once and then keeps its own selection, so a form
 * whose value changes underneath it — a reset, or defaults arriving after the first render — would
 * leave the buttons showing one thing and the form holding another.
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
              // Equal columns, so the buttons do not change width with the length of their words
              // and the control does not shuffle as the language changes.
              className="bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-md p-1"
            >
              {options.map((option) => (
                <RadioGroupPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'text-muted-foreground rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                    'hover:text-foreground focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                    'data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-xs'
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
