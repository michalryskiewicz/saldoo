import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFormContext } from 'react-hook-form';

type RHFRadioGroupProps = {
  name: string;
  label?: string;
  options: { label: string; value: string }[];
  helperText?: string;
  description?: string;
};

export const RHFRadioGroup = ({
  name,
  label,
  options,
  helperText,
  description,
}: RHFRadioGroupProps) => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        return (
          <FormItem className="space-y-1.5">
            {label && <FormLabel>{label}</FormLabel>}
            {description && <FormDescription>{description}</FormDescription>}
            <FormControl>
              {/* Controlled, not `defaultValue`: Radix reads that once and then keeps its
                  own selection, so a form whose value changes underneath it — a reset, or
                  defaults that arrive after the first render — leaves the dots showing one
                  thing and the form holding another. */}
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value ?? ''}
                className="flex flex-col"
              >
                {options.map((option) => {
                  return (
                    <FormItem key={option.value} className="flex items-center gap-3">
                      <FormControl>
                        <RadioGroupItem value={option.value} />
                      </FormControl>
                      <FormLabel className="font-normal">{option.label}</FormLabel>
                    </FormItem>
                  );
                })}
              </RadioGroup>
            </FormControl>
            {helperText && <FormDescription>{helperText}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
