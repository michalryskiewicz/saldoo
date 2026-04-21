import { GoogleDriveSync } from '../google-drive-sync.ts';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';

describe('GoogleDriveSync', () => {
  let googleDriveSync: GoogleDriveSync;

  beforeEach(() => {
    googleDriveSync = GoogleDriveSync.getInstance();
    googleDriveSync.setEncryptionKey('test-encryption-key');
  });

  afterEach(() => {
    googleDriveSync.clearEncryptionKey();
  });

  it('should encrypt and decrypt a string correctly', async () => {
    const plainText = 'This is a test string';

    // Encrypt the plain text
    const encrypted = await googleDriveSync['encryptString'](plainText);
    expect(encrypted).toBeTruthy();

    // Decrypt the encrypted text
    const decrypted = await googleDriveSync['decryptToString'](encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should throw an error if decryption is attempted without an encryption key', async () => {
    const plainText = 'This is a test string';
    const encrypted = await googleDriveSync['encryptString'](plainText);

    googleDriveSync.clearEncryptionKey();

    // Error message varies by environment (browser vs Node.js/jsdom), so we just check that it throws
    await expect(googleDriveSync['decryptToString'](encrypted)).rejects.toThrow();
  });

  it('should throw an error if decryption fails due to incorrect encryption key', async () => {
    const plainText = 'This is a test string';
    const encrypted = await googleDriveSync['encryptString'](plainText);

    googleDriveSync.setEncryptionKey('incorrect-key');

    // Error message varies by environment (browser vs Node.js/jsdom), so we just check that it throws
    await expect(googleDriveSync['decryptToString'](encrypted)).rejects.toThrow();
  });

  // New tests added below
  it('should reject decryption when ciphertext has been tampered with', async () => {
    const plainText = 'Tamper test string';
    const encrypted = await googleDriveSync['encryptString'](plainText);
    const envelope = JSON.parse(encrypted) as { salt: string; iv: string; ciphertext: string };

    // Tamper with the ciphertext by changing some bytes (use valid base64 chars)
    const originalCiphertext = envelope.ciphertext;
    // Flip a character in the middle to ensure we get a valid base64 but corrupted data
    const midPoint = Math.floor(originalCiphertext.length / 2);
    const charAtMid = originalCiphertext.charAt(midPoint);
    const flippedChar = charAtMid === 'A' ? 'B' : 'A';
    envelope.ciphertext =
      originalCiphertext.substring(0, midPoint) +
      flippedChar +
      originalCiphertext.substring(midPoint + 1);

    const tampered = JSON.stringify(envelope);

    // Error message varies by environment, so we just check that it throws
    await expect(googleDriveSync['decryptToString'](tampered)).rejects.toThrow();
  });

  it('should produce different encrypted outputs for the same input (different salt/iv)', async () => {
    const plainText = 'Same input different output';
    const encryptedA = await googleDriveSync['encryptString'](plainText);
    const encryptedB = await googleDriveSync['encryptString'](plainText);
    expect(encryptedA).not.toBe(encryptedB);
  });
});
