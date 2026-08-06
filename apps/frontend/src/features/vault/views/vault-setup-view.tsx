import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import {
  MIN_PASSPHRASE_LENGTH,
  validatePassphrase,
  type PassphraseProblem,
} from '@/crypto/passphrase-policy.service.ts';
import type { TranslationKey } from '@/i18n.ts';
import i18n from '@/i18n.ts';

const PROBLEM_MESSAGES: Record<PassphraseProblem, TranslationKey> = {
  'too-short': 'vault.error_too_short',
  mismatch: 'vault.error_mismatch',
};

type VaultSetupViewProps = {
  onSubmit: (passphrase: string) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
};

export function VaultSetupView({ onSubmit, isSubmitting, submitError }: VaultSetupViewProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<PassphraseProblem | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const found = validatePassphrase(passphrase, confirmation);
    setProblem(found);
    if (found) return;

    await onSubmit(passphrase);
  };

  const errorMessage = problem ? i18n.t(PROBLEM_MESSAGES[problem]) : submitError;

  return (
    <form className="grid grid-cols-[minmax(0,1fr)] gap-6" onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Label htmlFor="vault-passphrase">{i18n.t('vault.passphrase_label')}</Label>
        <Input
          id="vault-passphrase"
          type="password"
          autoComplete="new-password"
          autoFocus
          minLength={MIN_PASSPHRASE_LENGTH}
          value={passphrase}
          aria-invalid={problem === 'too-short'}
          aria-describedby="vault-passphrase-hint"
          onChange={(event) => setPassphrase(event.target.value)}
        />
        <p id="vault-passphrase-hint" className="text-muted-foreground text-xs">
          {i18n.t('vault.passphrase_hint')}
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Label htmlFor="vault-passphrase-confirm">
          {i18n.t('vault.passphrase_confirm_label')}
        </Label>
        <Input
          id="vault-passphrase-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          aria-invalid={problem === 'mismatch'}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      {errorMessage && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {i18n.t('vault.create_button')}
      </Button>
    </form>
  );
}
