import { describe, it, expect } from 'vitest';
import { resolveVaultGateStatus } from '../vault-gate-status.service.ts';

describe('resolveVaultGateStatus', () => {
  it('shows the unlock screen once the session has been locked', () => {
    // What the idle lock actually does is drop the key from the session. The gate
    // has to follow that, or the app stays on screen with no key behind it.
    expect(resolveVaultGateStatus('unlocked', false)).toBe('locked');
  });

  it('keeps the app up while the session holds the key', () => {
    expect(resolveVaultGateStatus('unlocked', true)).toBe('unlocked');
  });

  it('leaves the recovery code on screen even though nothing is unlocked yet', () => {
    // Locking mid-setup would lose the one copy of the recovery code that exists.
    expect(resolveVaultGateStatus('showing-recovery-code', true)).toBe('showing-recovery-code');
  });

  it('does not turn a device that has never set up into a locked one', () => {
    expect(resolveVaultGateStatus('needs-setup', false)).toBe('needs-setup');
    expect(resolveVaultGateStatus('checking', false)).toBe('checking');
    expect(resolveVaultGateStatus('unavailable', false)).toBe('unavailable');
    expect(resolveVaultGateStatus('failed', false)).toBe('failed');
  });
});
