import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import type { UnlockSecret } from '@/crypto/vault.service.ts';
import i18n from '@/i18n.ts';

type VaultUnlockViewProps = {
  onUnlock: (secret: UnlockSecret) => Promise<void>;
  isUnlocking: boolean;
  unlockError: string | null;
};

export function VaultUnlockView({ onUnlock, isUnlocking, unlockError }: VaultUnlockViewProps) {
  const [usingRecoveryCode, setUsingRecoveryCode] = useState(false);
  const [secretValue, setSecretValue] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onUnlock(
      usingRecoveryCode
        ? { kind: 'recovery-code', recoveryCode: secretValue }
        : { kind: 'passphrase', passphrase: secretValue }
    );
  };

  const switchMode = () => {
    setUsingRecoveryCode((previous) => !previous);
    setSecretValue('');
  };

  return (
    <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <Label htmlFor="vault-secret">
          {usingRecoveryCode
            ? i18n.t('vault.recovery_code_label')
            : i18n.t('vault.passphrase_label')}
        </Label>
        <Input
          id="vault-secret"
          key={usingRecoveryCode ? 'recovery-code' : 'passphrase'}
          type={usingRecoveryCode ? 'text' : 'password'}
          autoComplete={usingRecoveryCode ? 'off' : 'current-password'}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          value={secretValue}
          aria-invalid={!!unlockError}
          onChange={(event) => setSecretValue(event.target.value)}
        />
      </div>

      {unlockError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {unlockError}
        </p>
      )}

      <Button type="submit" disabled={isUnlocking || secretValue.trim() === ''}>
        {isUnlocking && <Spinner />}
        {i18n.t('vault.unlock_button')}
      </Button>

      <Button variant="ghost" type="button" onClick={switchMode}>
        {usingRecoveryCode ? i18n.t('vault.use_passphrase') : i18n.t('vault.use_recovery_code')}
      </Button>
    </form>
  );
}
