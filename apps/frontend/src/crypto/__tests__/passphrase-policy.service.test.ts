import { describe, it, expect } from 'vitest';
import {
  MIN_PASSPHRASE_LENGTH,
  validatePassphrase,
} from '../passphrase-policy.service.ts';

const LONG_ENOUGH = 'x'.repeat(MIN_PASSPHRASE_LENGTH);

describe('validatePassphrase', () => {
  it('accepts a matching pair at the minimum length', () => {
    expect(validatePassphrase(LONG_ENOUGH, LONG_ENOUGH)).toBeNull();
  });

  it('rejects a passphrase one character too short', () => {
    const short = 'x'.repeat(MIN_PASSPHRASE_LENGTH - 1);

    expect(validatePassphrase(short, short)).toBe('too-short');
  });

  it('rejects an empty passphrase', () => {
    expect(validatePassphrase('', '')).toBe('too-short');
  });

  it('does not let whitespace pad out the length', () => {
    const padded = `  ${'x'.repeat(4)}${' '.repeat(20)}`;

    expect(validatePassphrase(padded, padded)).toBe('too-short');
  });

  it('reports the mismatch when both are long enough but differ', () => {
    expect(validatePassphrase(LONG_ENOUGH, `${LONG_ENOUGH}!`)).toBe('mismatch');
  });

  it('reports length before mismatch, so the user fixes the real problem first', () => {
    expect(validatePassphrase('short', 'different')).toBe('too-short');
  });

  it('treats a trailing space as a real difference', () => {
    expect(validatePassphrase(LONG_ENOUGH, `${LONG_ENOUGH} `)).toBe('mismatch');
  });
});
