import { describe, it, expect } from 'vitest';
import { resolveTokenPrompt } from '../token-prompt.service.ts';

describe('resolveTokenPrompt', () => {
  it('asks for silence on the silent path, whether or not an account is remembered', () => {
    // `'none'` is the documented "display nothing". The previous value, `''`, only
    // promised "not every time" — which is how a renewal nobody clicked for could put a
    // window on screen.
    expect(resolveTokenPrompt(true, null)).toBe('none');
    expect(resolveTokenPrompt(true, 'michal@example.com')).toBe('none');
  });

  it('skips the chooser when it knows who is signing in', () => {
    expect(resolveTokenPrompt(false, 'michal@example.com')).toBe('');
  });

  it('offers the chooser on a device that has never signed in', () => {
    expect(resolveTokenPrompt(false, null)).toBe('select_account');
  });

  it('never asks for consent', () => {
    // The guard that matters: consent re-approved a grant that already existed, on every
    // sign-in. No combination of inputs may bring it back.
    for (const silent of [true, false]) {
      for (const hint of [null, '', 'michal@example.com']) {
        expect(resolveTokenPrompt(silent, hint)).not.toContain('consent');
      }
    }
  });
});
