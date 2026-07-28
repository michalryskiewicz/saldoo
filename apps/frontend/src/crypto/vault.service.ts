import { base64ToBytes, bytesToBase64 } from './base64.ts';
import { generateRecoveryCode, normalizeRecoveryCode } from './recovery-code.ts';

export const KEYFILE_FORMAT_VERSION = 1;

/** OWASP's 2026 floor for PBKDF2-SHA256 against a human-chosen passphrase. */
export const PASSPHRASE_ITERATIONS = 600_000;

/** A recovery code carries 128 bits already, so stretching it is a formality. */
export const RECOVERY_CODE_ITERATIONS = 100_000;

const DEK_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type KeyslotKind = 'passphrase' | 'recovery-code' | 'passkey-prf';

export type Keyslot = {
  kind: KeyslotKind;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string } | null;
  wrapped: { iv: string; ciphertext: string };
};

/**
 * The public half of a vault: which secrets can open it, and the data key
 * encrypted once per secret. Safe to store next to the ciphertext — every slot
 * is useless without the secret that opens it.
 */
export type Keyfile = {
  formatVersion: number;
  keyslots: Keyslot[];
};

export type EncryptedPayload = {
  formatVersion: number;
  iv: string;
  ciphertext: string;
};

export type UnlockSecret =
  | { kind: 'passphrase'; passphrase: string }
  | { kind: 'recovery-code'; recoveryCode: string }
  | { kind: 'passkey-prf'; prfOutput: Uint8Array };

export class VaultUnlockError extends Error {
  constructor(message = 'No keyslot could be opened with the supplied secret') {
    super(message);
    this.name = 'VaultUnlockError';
  }
}

export class UnsupportedKeyfileError extends Error {
  constructor(formatVersion: number) {
    super(`Unsupported keyfile format version: ${formatVersion}`);
    this.name = 'UnsupportedKeyfileError';
  }
}

function secretMaterial(secret: UnlockSecret): Uint8Array {
  switch (secret.kind) {
    case 'passphrase':
      return new TextEncoder().encode(secret.passphrase);
    case 'recovery-code':
      return new TextEncoder().encode(normalizeRecoveryCode(secret.recoveryCode));
    case 'passkey-prf':
      return secret.prfOutput;
  }
}

function defaultIterations(kind: KeyslotKind): number {
  switch (kind) {
    case 'passphrase':
      return PASSPHRASE_ITERATIONS;
    case 'recovery-code':
      return RECOVERY_CODE_ITERATIONS;
    case 'passkey-prf':
      return 1;
  }
}

async function deriveKeyEncryptionKey(
  secret: UnlockSecret,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretMaterial(secret) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypts the data key under one secret, producing a slot that can be stored
 * publicly. Adding a slot never touches the data itself.
 */
export async function createKeyslot(
  dek: CryptoKey,
  secret: UnlockSecret,
  iterations = defaultIterations(secret.kind)
): Promise<Keyslot> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const kek = await deriveKeyEncryptionKey(secret, salt, iterations);

  const rawDek = await crypto.subtle.exportKey('raw', dek);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, kek, rawDek);

  return {
    kind: secret.kind,
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: bytesToBase64(salt) },
    wrapped: { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) },
  };
}

/**
 * Creates a brand new vault: a random data key, plus the two slots every vault
 * must have — the passphrase the user chose and the recovery code that saves
 * them when they forget it.
 *
 * The returned recovery code is the only copy in existence; it is never derivable
 * from the keyfile.
 */
export async function createVault(options: {
  passphrase: string;
  passphraseIterations?: number;
  recoveryCodeIterations?: number;
}): Promise<{ dek: CryptoKey; recoveryCode: string; keyfile: Keyfile }> {
  const dek = await importDek(crypto.getRandomValues(new Uint8Array(DEK_BYTES)));
  const recoveryCode = generateRecoveryCode();

  const keyslots = await Promise.all([
    createKeyslot(dek, { kind: 'passphrase', passphrase: options.passphrase }, options.passphraseIterations),
    createKeyslot(dek, { kind: 'recovery-code', recoveryCode }, options.recoveryCodeIterations),
  ]);

  return { dek, recoveryCode, keyfile: { formatVersion: KEYFILE_FORMAT_VERSION, keyslots } };
}

/**
 * Recovers the data key by trying every slot the secret could plausibly open.
 *
 * @throws {VaultUnlockError} when the secret opens none of them — this is the
 * expected signal for "wrong passphrase", not an exceptional condition.
 */
export async function unlockVault(keyfile: Keyfile, secret: UnlockSecret): Promise<CryptoKey> {
  if (keyfile.formatVersion !== KEYFILE_FORMAT_VERSION) {
    throw new UnsupportedKeyfileError(keyfile.formatVersion);
  }

  for (const slot of keyfile.keyslots) {
    if (slot.kind !== secret.kind || !slot.kdf) continue;

    try {
      const kek = await deriveKeyEncryptionKey(
        secret,
        base64ToBytes(slot.kdf.salt),
        slot.kdf.iterations
      );
      const rawDek = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(slot.wrapped.iv) as BufferSource },
        kek,
        base64ToBytes(slot.wrapped.ciphertext) as BufferSource
      );

      return await importDek(new Uint8Array(rawDek));
    } catch {
      // Wrong secret for this slot — keep trying the rest.
    }
  }

  throw new VaultUnlockError();
}

/** Adds an unlock method without re-encrypting any data. */
export async function addKeyslot(
  keyfile: Keyfile,
  dek: CryptoKey,
  secret: UnlockSecret,
  iterations?: number
): Promise<Keyfile> {
  const slot = await createKeyslot(dek, secret, iterations);
  return { ...keyfile, keyslots: [...keyfile.keyslots, slot] };
}

/** Replaces every slot of a kind, e.g. when the user changes their passphrase. */
export async function replaceKeyslot(
  keyfile: Keyfile,
  dek: CryptoKey,
  secret: UnlockSecret,
  iterations?: number
): Promise<Keyfile> {
  const slot = await createKeyslot(dek, secret, iterations);
  const kept = keyfile.keyslots.filter((existing) => existing.kind !== secret.kind);
  return { ...keyfile, keyslots: [...kept, slot] };
}

export async function encryptWithDek(dek: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    dek,
    new TextEncoder().encode(plaintext)
  );

  return {
    formatVersion: KEYFILE_FORMAT_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptWithDek(dek: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) as BufferSource },
    dek,
    base64ToBytes(payload.ciphertext) as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}
