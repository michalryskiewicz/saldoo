import { cn } from '@/lib/utils.ts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { paths } from '@/routes/paths.ts';
import { CONFIG } from '@/global-config.ts';
import i18n from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { signInWithAnotherGoogleAccount, signInWithGoogle } from '@/auth/context/google';
import { loginHintStore } from '@/auth/google/login-hint.store.ts';
import { Logo } from '@/components/logo.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Label } from '@/components/ui/label.tsx';
import { useState } from 'react';
import { Link } from 'react-router';

export function LoginForm() {
  const [acceptedRules, setAcceptedRules] = useState<boolean>(false);
  // Read once: whether this device already knows who signs in decides whether switching
  // account is even a thing to offer. With no hint, Google shows the chooser anyway.
  const [remembersAccount] = useState<boolean>(() => loginHintStore.read() !== null);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href={paths.dashboard.root} className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <Logo className="size-5" />
          </div>
          {CONFIG.appName}
        </a>
        <div className={cn('flex flex-col gap-6')}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{i18n.t('welcome_in_saldoo')}</CardTitle>
              <CardDescription>{i18n.t('welcome_back_sign_in')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={!acceptedRules}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {i18n.t('login_with_google')}
                </Button>

                {remembersAccount && (
                  <Button
                    variant="link"
                    type="button"
                    className="text-muted-foreground h-auto justify-self-center p-0 text-sm"
                    onClick={signInWithAnotherGoogleAccount}
                    disabled={!acceptedRules}
                  >
                    {i18n.t('sign_in_with_another_account')}
                  </Button>
                )}

                <div className="flex items-start gap-3">
                  <Checkbox id="terms-2" onClick={() => setAcceptedRules((p) => !p)} />
                  <div className="grid gap-2">
                    <Label htmlFor="terms-2">{i18n.t('accept_terms_and_conditions')}</Label>
                    <p className="text-muted-foreground text-sm *:[a]:hover:text-primary  text-balance *:[a]:underline *:[a]:underline-offset-4">
                      {i18n.t('register_by_you_agree')}{' '}
                      <Link to={paths.docs.termsAndConditions}>{i18n.t('terms_of_service')}</Link>{' '}
                      {i18n.t('and')}{' '}
                      <Link to={paths.docs.privacyPolicy}>{i18n.t('privacy_policy')}</Link>.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
