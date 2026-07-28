import { describe, it, expect } from 'vitest';
import {
  addKeyslot,
  createVault,
  decryptWithDek,
  encryptWithDek,
  KEYFILE_FORMAT_VERSION,
  PASSPHRASE_ITERATIONS,
  replaceKeyslot,
  UnsupportedKeyfileError,
  unlockVault,
  VaultUnlockError,
  type Keyfile,
} from '../vault.service.ts';
import { formatRecoveryCode } from '../recovery-code.ts';

const FAST = { passphraseIterations: 1_000, recoveryCodeIterations: 1_000 };
const PASSPHRASE = 'correct horse battery staple';
const SECRET_DATA = JSON.stringify({ expenses: [{ amount: 1234.56 }] });

async function newVault(passphrase = PASSPHRASE) {
  return createVault({ passphrase, ...FAST });
}

describe('createVault', () => {
  it('opens with both the passphrase and the recovery code', async () => {
    const { keyfile } = await newVault();

    expect(keyfile.keyslots.map((slot) => slot.kind).sort()).toEqual([
      'passphrase',
      'recovery-code',
    ]);
  });

  it('stamps the keyfile with its format version', async () => {
    const { keyfile } = await newVault();

    expect(keyfile.formatVersion).toBe(KEYFILE_FORMAT_VERSION);
  });

  it('issues a different data key and recovery code for every vault', async () => {
    const [first, second] = await Promise.all([newVault(), newVault()]);

    expect(first.recoveryCode).not.toBe(second.recoveryCode);
    await expect(
      decryptWithDek(second.dek, await encryptWithDek(first.dek, SECRET_DATA))
    ).rejects.toThrow();
  });

  it('leaks neither the data key nor the secrets into the keyfile', async () => {
    const { dek, recoveryCode, keyfile } = await newVault();
    const rawDek = new Uint8Array(await crypto.subtle.exportKey('raw', dek));

    const serialized = JSON.stringify(keyfile);
    expect(serialized).not.toContain(PASSPHRASE);
    expect(serialized).not.toContain(recoveryCode);
    expect(serialized).not.toContain(btoa(String.fromCharCode(...rawDek)));
  });

  it('defaults to the OWASP iteration floor for passphrase slots', async () => {
    expect(PASSPHRASE_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it('records the iteration count and a unique salt per slot', async () => {
    const { keyfile } = await newVault();
    const [first, second] = keyfile.keyslots;

    expect(first.kdf?.iterations).toBe(1_000);
    expect(first.kdf?.salt).not.toBe(second.kdf?.salt);
  });
});

describe('unlockVault', () => {
  it('recovers a data key that decrypts what the original encrypted', async () => {
    const { dek, keyfile } = await newVault();
    const payload = await encryptWithDek(dek, SECRET_DATA);

    const unlocked = await unlockVault(keyfile, { kind: 'passphrase', passphrase: PASSPHRASE });

    await expect(decryptWithDek(unlocked, payload)).resolves.toBe(SECRET_DATA);
  });

  it('accepts the recovery code exactly as the user was shown it', async () => {
    const { dek, recoveryCode, keyfile } = await newVault();
    const payload = await encryptWithDek(dek, SECRET_DATA);

    const unlocked = await unlockVault(keyfile, {
      kind: 'recovery-code',
      recoveryCode: formatRecoveryCode(recoveryCode).toLowerCase(),
    });

    await expect(decryptWithDek(unlocked, payload)).resolves.toBe(SECRET_DATA);
  });

  it('refuses a wrong passphrase', async () => {
    const { keyfile } = await newVault();

    await expect(
      unlockVault(keyfile, { kind: 'passphrase', passphrase: 'not the passphrase' })
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('refuses a secret of a kind the vault has no slot for', async () => {
    const { keyfile } = await newVault();

    await expect(
      unlockVault(keyfile, { kind: 'passkey-prf', prfOutput: new Uint8Array(32) })
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('refuses a keyfile written by a future version', async () => {
    const { keyfile } = await newVault();
    const future: Keyfile = { ...keyfile, formatVersion: KEYFILE_FORMAT_VERSION + 1 };

    await expect(
      unlockVault(future, { kind: 'passphrase', passphrase: PASSPHRASE })
    ).rejects.toBeInstanceOf(UnsupportedKeyfileError);
  });

  it('refuses a keyfile whose wrapped key has been tampered with', async () => {
    const { keyfile } = await newVault();
    const tampered: Keyfile = {
      ...keyfile,
      keyslots: keyfile.keyslots.map((slot) => ({
        ...slot,
        wrapped: { ...slot.wrapped, ciphertext: btoa('tampered-ciphertext-padding') },
      })),
    };

    await expect(
      unlockVault(tampered, { kind: 'passphrase', passphrase: PASSPHRASE })
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });
});

describe('addKeyslot', () => {
  it('adds an unlock method without invalidating already-encrypted data', async () => {
    const { dek, keyfile } = await newVault();
    const payload = await encryptWithDek(dek, SECRET_DATA);
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));

    const extended = await addKeyslot(keyfile, dek, { kind: 'passkey-prf', prfOutput });
    const unlocked = await unlockVault(extended, { kind: 'passkey-prf', prfOutput });

    await expect(decryptWithDek(unlocked, payload)).resolves.toBe(SECRET_DATA);
  });

  it('keeps the existing slots working', async () => {
    const { dek, keyfile } = await newVault();
    const extended = await addKeyslot(
      keyfile,
      dek,
      { kind: 'passkey-prf', prfOutput: new Uint8Array(32) },
      1_000
    );

    await expect(
      unlockVault(extended, { kind: 'passphrase', passphrase: PASSPHRASE })
    ).resolves.toBeDefined();
  });
});

describe('replaceKeyslot', () => {
  it('rotates the passphrase while the data stays readable', async () => {
    const { dek, keyfile } = await newVault();
    const payload = await encryptWithDek(dek, SECRET_DATA);

    const rotated = await replaceKeyslot(
      keyfile,
      dek,
      { kind: 'passphrase', passphrase: 'a brand new passphrase' },
      1_000
    );

    const unlocked = await unlockVault(rotated, {
      kind: 'passphrase',
      passphrase: 'a brand new passphrase',
    });
    await expect(decryptWithDek(unlocked, payload)).resolves.toBe(SECRET_DATA);
  });

  it('retires the old passphrase', async () => {
    const { dek, keyfile } = await newVault();
    const rotated = await replaceKeyslot(
      keyfile,
      dek,
      { kind: 'passphrase', passphrase: 'a brand new passphrase' },
      1_000
    );

    await expect(
      unlockVault(rotated, { kind: 'passphrase', passphrase: PASSPHRASE })
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('leaves the recovery code slot intact', async () => {
    const { dek, recoveryCode, keyfile } = await newVault();
    const rotated = await replaceKeyslot(
      keyfile,
      dek,
      { kind: 'passphrase', passphrase: 'a brand new passphrase' },
      1_000
    );

    await expect(
      unlockVault(rotated, { kind: 'recovery-code', recoveryCode })
    ).resolves.toBeDefined();
  });
});

describe('encryptWithDek', () => {
  it('never reuses an IV, so identical data yields different ciphertext', async () => {
    const { dek } = await newVault();

    const first = await encryptWithDek(dek, SECRET_DATA);
    const second = await encryptWithDek(dek, SECRET_DATA);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('round-trips unicode payloads', async () => {
    const { dek } = await newVault();
    const payload = 'zażółć gęślą jaźń — 💸';

    await expect(decryptWithDek(dek, await encryptWithDek(dek, payload))).resolves.toBe(payload);
  });

  it('rejects tampered ciphertext instead of returning garbage', async () => {
    const { dek } = await newVault();
    const payload = await encryptWithDek(dek, SECRET_DATA);

    await expect(
      decryptWithDek(dek, { ...payload, ciphertext: btoa('tampered-ciphertext-padding') })
    ).rejects.toThrow();
  });
});
