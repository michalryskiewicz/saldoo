import type { ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * One question a form asks, with the fields that answer it.
 *
 * The expense form was seven fields in a single run, so "what am I buying" sat exactly as close to
 * "which budget-strategy category is this" as it did to "how much" — and those are not the same
 * question. Nothing in the layout said where one thought ended and the next began, which is what
 * made a short form feel like a list to get through.
 *
 * The heading is the table's heading type on purpose: quiet, small, uppercase. It is a label for a
 * group, not a title competing with the field labels underneath it.
 */
export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-muted-foreground border-b pb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
