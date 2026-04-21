import { useState, type ReactNode, type PropsWithoutRef } from 'react';
import { FormProvider, useForm, type UseFormProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DevTool } from '@hookform/devtools';
import { CONFIG } from '@/global-config.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FormProps<S extends z.ZodType<any, any>>
  extends Omit<PropsWithoutRef<React.JSX.IntrinsicElements['form']>, 'onSubmit'> {
  /** All your form fields */
  children?: ReactNode;
  /** Text to display in the submit button */
  submitText?: string;
  schema?: S;
  onSubmit: (values: z.infer<S>) => Promise<void | OnSubmitResult>;
  initialValues?: UseFormProps<z.infer<S>>['defaultValues'];
  noDevTools?: boolean;
  resetFields?: Partial<z.infer<S>>;
}

interface OnSubmitResult {
  FORM_ERROR?: string;
  [prop: string]: any;
}

export const FORM_ERROR = 'FORM_ERROR';

export function Form<S extends z.ZodType<any, any>>({
  children,
  submitText,
  schema,
  initialValues,
  onSubmit,
  noDevTools,
  resetFields,
  ...props
}: FormProps<S>) {
  const ctx = useForm<z.infer<S>>({
    mode: 'onBlur',
    resolver: schema ? (zodResolver(schema) as any) : undefined,
    defaultValues: initialValues,
  });
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <FormProvider {...ctx}>
      <form
        onSubmit={ctx.handleSubmit(async (values) => {
          const result = (await onSubmit(values)) || {};

          if (resetFields && Object.keys(resetFields)?.length > 0) {
            ctx.reset({ ...values, ...resetFields });
          }

          for (const [key, value] of Object.entries(result)) {
            if (key === FORM_ERROR) {
              setFormError(value);
            } else {
              ctx.setError(key as any, {
                type: 'submit',
                message: value,
              });
            }
          }
        })}
        className="form"
        {...props}
      >
        {/* Form fields supplied as children are rendered here */}
        {children}

        {formError && (
          <div role="alert" style={{ color: 'red' }}>
            {formError}
          </div>
        )}

        {submitText && (
          <button type="submit" disabled={ctx.formState.isSubmitting}>
            {submitText}
          </button>
        )}
        {CONFIG.devMode && !noDevTools && <DevTool control={ctx.control} />}
      </form>
    </FormProvider>
  );
}

export default Form;
