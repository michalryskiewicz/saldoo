import { describe, it, expect } from 'vitest';
import {
  formatRecoveryCode,
  generateRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_LENGTH,
} from '../recovery-code.ts';

describe('generateRecoveryCode', () => {
  it('produces a code carrying the full 128 bits of entropy', () => {
    expect(normalizeRecoveryCode(generateRecoveryCode())).toHaveLength(RECOVERY_CODE_LENGTH);
  });

  it('produces a different code every time', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));

    expect(codes.size).toBe(50);
  });

  it('never emits characters that can be misread', () => {
    const codes = Array.from({ length: 50 }, () => normalizeRecoveryCode(generateRecoveryCode()));

    for (const code of codes) {
      expect(code).not.toMatch(/[ILOU]/);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    }
  });

  it('is displayed in dash-separated groups of five', () => {
    expect(formatRecoveryCode('0123456789ABCDEFGHJKMNPQRS')).toBe(
      '01234-56789-ABCDE-FGHJK-MNPQR-S'
    );
  });
});

describe('normalizeRecoveryCode', () => {
  it('accepts the formatted form the user was shown', () => {
    const code = generateRecoveryCode();

    expect(normalizeRecoveryCode(code)).toBe(normalizeRecoveryCode(formatRecoveryCode(code)));
  });

  it('is forgiving about case, spaces and dashes', () => {
    expect(normalizeRecoveryCode(' abcde-fghjk mnpqr ')).toBe('ABCDEFGHJKMNPQR');
  });

  it('maps look-alike characters onto their canonical form', () => {
    expect(normalizeRecoveryCode('OIL')).toBe('011');
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => normalizeRecoveryCode('ABC!DEF')).toThrow(/invalid/i);
  });
});
