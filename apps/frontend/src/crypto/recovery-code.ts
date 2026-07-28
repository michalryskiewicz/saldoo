const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP_SIZE = 5;
const ENTROPY_BYTES = 16;

/** Characters of the normalized code — 16 bytes of entropy at 5 bits per character. */
export const RECOVERY_CODE_LENGTH = Math.ceil((ENTROPY_BYTES * 8) / 5);

const LOOK_ALIKES: Record<string, string> = { O: '0', I: '1', L: '1' };

/**
 * Generates the recovery code that is the root of trust for a vault.
 *
 * 128 bits drawn from the CSPRNG, rendered in Crockford's base32 so that a user
 * transcribing it from paper cannot confuse `O` with `0` or `I` with `1`.
 */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ENTROPY_BYTES));

  let bits = 0;
  let bitCount = 0;
  let code = '';

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      bitCount -= 5;
      code += ALPHABET[(bits >>> bitCount) & 0b11111];
    }
  }

  if (bitCount > 0) code += ALPHABET[(bits << (5 - bitCount)) & 0b11111];

  return code;
}

/** Renders a code for display: dash-separated groups of five. */
export function formatRecoveryCode(code: string): string {
  const groups = code.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'g')) ?? [];
  return groups.join('-');
}

/**
 * Brings user input back to the canonical form used for key derivation, so that
 * whitespace, lower case and misread look-alikes still unlock the vault.
 *
 * @throws if the input contains a character that carries no meaning in the alphabet.
 */
export function normalizeRecoveryCode(input: string): string {
  const stripped = input.replace(/[\s-]/g, '').toUpperCase();

  let normalized = '';
  for (const char of stripped) {
    const canonical = LOOK_ALIKES[char] ?? char;
    if (!ALPHABET.includes(canonical)) {
      throw new Error(`Recovery code contains an invalid character: ${char}`);
    }
    normalized += canonical;
  }

  return normalized;
}
