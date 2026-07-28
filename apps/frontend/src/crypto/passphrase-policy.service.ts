/**
 * Long enough that 600k PBKDF2 iterations make offline guessing impractical.
 * Length beats character classes here: the keyfile is on Drive, so an attacker who
 * gets it can grind offline at their own pace.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

export type PassphraseProblem = 'too-short' | 'mismatch';

/** @returns the first problem worth showing, or `null` when the pair is usable. */
export function validatePassphrase(
  passphrase: string,
  confirmation: string
): PassphraseProblem | null {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) return 'too-short';
  if (passphrase !== confirmation) return 'mismatch';

  return null;
}
