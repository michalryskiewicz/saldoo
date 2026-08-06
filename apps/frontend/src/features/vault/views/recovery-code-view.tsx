import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Label } from '@/components/ui/label.tsx';
import { formatRecoveryCode } from '@/crypto/recovery-code.ts';
import i18n from '@/i18n.ts';

type RecoveryCodeViewProps = {
  recoveryCode: string;
  onConfirmed: () => void;
};

export function RecoveryCodeView({ recoveryCode, onConfirmed }: RecoveryCodeViewProps) {
  const [hasSavedIt, setHasSavedIt] = useState(false);
  const [wasCopied, setWasCopied] = useState(false);

  const formatted = formatRecoveryCode(recoveryCode);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setWasCopied(true);
    } catch {
      setWasCopied(false);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <p className="text-muted-foreground text-sm">{i18n.t('vault.recovery_description')}</p>

      <code
        aria-label={i18n.t('vault.recovery_code_label')}
        className="bg-muted block rounded-md p-4 text-center font-mono text-sm tracking-widest break-all select-all"
      >
        {formatted}
      </code>

      <Button variant="outline" type="button" onClick={copyToClipboard}>
        {wasCopied ? i18n.t('vault.recovery_copied') : i18n.t('vault.recovery_copy')}
      </Button>

      <p role="alert" className="text-destructive text-sm font-medium">
        {i18n.t('vault.recovery_warning')}
      </p>

      <div className="flex items-start gap-3">
        <Checkbox
          id="recovery-code-saved"
          checked={hasSavedIt}
          onCheckedChange={(checked) => setHasSavedIt(checked === true)}
        />
        <Label htmlFor="recovery-code-saved" className="leading-snug">
          {i18n.t('vault.recovery_confirm_label')}
        </Label>
      </div>

      <Button type="button" disabled={!hasSavedIt} onClick={onConfirmed}>
        {i18n.t('vault.recovery_continue')}
      </Button>
    </div>
  );
}
