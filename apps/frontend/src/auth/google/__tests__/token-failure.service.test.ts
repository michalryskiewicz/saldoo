import { describe, it, expect } from 'vitest';
import { classifyTokenFailure } from '../token-failure.service.ts';

describe('classifyTokenFailure', () => {
  it.each(['login_required', 'consent_required', 'interaction_required', 'account_selection_required'])(
    'reads %s as needing the person to act',
    (code) => {
      expect(classifyTokenFailure(code)).toBe('needs-interaction');
    }
  );

  it.each(['access_denied', 'admin_policy_enforced'])('reads %s as a refusal', (code) => {
    expect(classifyTokenFailure(code)).toBe('refused');
  });

  it('reads a blocked popup as something that may work next time', () => {
    expect(classifyTokenFailure('popup_failed_to_open')).toBe('unavailable');
  });

  it('reads a closed popup as unavailable rather than a refusal', () => {
    // Closing the window is not saying no — the next click is free, and calling this a
    // refusal would evict someone who slipped.
    expect(classifyTokenFailure('popup_closed')).toBe('unavailable');
  });

  it('reads an absent code as unavailable', () => {
    expect(classifyTokenFailure(undefined)).toBe('unavailable');
  });

  it('reads an unknown code as unavailable', () => {
    // The safe default: only a code Google documents as a refusal ends a session.
    expect(classifyTokenFailure('something_nobody_has_seen')).toBe('unavailable');
  });
});
