import type { PropsWithChildren } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { Logo } from '@/components/logo.tsx';
import { CONFIG } from '@/global-config.ts';
import type { TranslationKey } from '@/i18n.ts';
import i18n from '@/i18n.ts';

type VaultShellViewProps = PropsWithChildren<{
  title: TranslationKey;
  description: TranslationKey;
}>;

/** The centred single-card frame the vault screens share with the login screen. */
export function VaultShellView({ title, description, children }: VaultShellViewProps) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <Logo className="size-5" />
          </div>
          {CONFIG.appName}
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{i18n.t(title)}</CardTitle>
            <CardDescription>{i18n.t(description)}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
