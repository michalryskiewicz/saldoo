// language: typescript
// File: frontend/src/database/sync/google-drive-sync.ts

import { type DatabaseType, db, isDatabaseEmpty } from '@/database/index.ts';
import { exportDB, importInto } from 'dexie-export-import';
import {
  getAccessTokenFromCookies,
  getOrCreateFileIdInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '@/database/sync/googleDriveUtils.ts';
import { CONFIG } from '@/global-config.ts';
import { getLastUpdated } from '@/database/meta.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Fix: accept BufferSource to satisfy WebCrypto typing
async function deriveKeyFromPassword(password: string, salt: BufferSource): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export class GoogleDriveSync {
  private static _instance: GoogleDriveSync | null = null;
  private encryptionKey?: string;

  private constructor() {}

  static getInstance(): GoogleDriveSync {
    if (!GoogleDriveSync._instance) GoogleDriveSync._instance = new GoogleDriveSync();
    return GoogleDriveSync._instance;
  }

  setEncryptionKey(key?: string) {
    this.encryptionKey = key;
  }

  clearEncryptionKey() {
    this.encryptionKey = undefined;
  }

  async encryptString(plain: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKeyFromPassword(this.encryptionKey ?? '', salt);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plain));
    const envelope = {
      salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      ciphertext: arrayBufferToBase64(cipher as ArrayBuffer),
    };
    return JSON.stringify(envelope);
  }

  async decryptToString(envelopeJson: string): Promise<string> {
    const envelope = JSON.parse(envelopeJson) as { salt: string; iv: string; ciphertext: string };
    const salt = base64ToArrayBuffer(envelope.salt);
    const iv = base64ToArrayBuffer(envelope.iv);
    const ciphertext = base64ToArrayBuffer(envelope.ciphertext);
    const key = await deriveKeyFromPassword(this.encryptionKey ?? '', salt);
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return decoder.decode(plainBuffer);
  }

  private async blobToJson<T = never>(blob: Blob): Promise<T> {
    const text = await blob.text();
    return JSON.parse(text);
  }

  async exportToDrive() {
    if (!this.encryptionKey) {
      console.error('No encryption key provided');
      return;
    }

    const accessToken = getAccessTokenFromCookies();
    if (!accessToken) {
      console.error('No access token found');
      return;
    }
    const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, CONFIG.dataSourceFile);
    if (!fileId) {
      console.error('Could not get or create file in saldoo folder');
      return;
    }
    if (await isDatabaseEmpty()) {
      console.error('Database is empty. Export aborted.');
      return;
    }

    const dbBlob = await exportDB(db);
    let dbJson;
    try {
      dbJson = await this.blobToJson(dbBlob);
    } catch (e) {
      console.error('Failed to parse exported DB blob:', e);
      return;
    }

    try {
      const clear = JSON.stringify(dbJson);
      const contentToWrite = await this.encryptString(clear);
      await writeFileToDrive(accessToken, fileId, contentToWrite);
      console.log('Database exported to Google Drive');
    } catch (e) {
      console.error('Failed to write file to Google Drive:', e);
    }
  }

  async importFromDrive() {
    if (!this.encryptionKey) {
      console.error('No encryptionKey found');
      return;
    }

    const accessToken = getAccessTokenFromCookies();
    if (!accessToken) return;
    const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, CONFIG.dataSourceFile);
    if (!fileId) return;
    const fileContent = await readFileFromDrive(accessToken, fileId);
    if (!fileContent || fileContent.trim() === '') {
      console.log('Remote file is empty, skipping import');
      return;
    }

    let clearContent = fileContent;
    try {
      clearContent = await this.decryptToString(fileContent);
    } catch (e) {
      console.error('Failed to decrypt DB file:', e);
      return;
    }

    const dbBlob = new Blob([clearContent], { type: 'application/json' });
    await importInto(db, dbBlob, { overwriteValues: true });
    console.log('Database imported from Google Drive');
    // Note: The imported data already contains the correct lastUpdated timestamp in meta table
    // so we don't need to manually set it here - it's part of the imported data
  }

  private async getRemoteLastModified(accessToken: string, fileId: string): Promise<number> {
    const fileContent = await readFileFromDrive(accessToken, fileId);
    // If file is null, or empty string (newly created file), return -1
    if (!fileContent || fileContent.trim() === '') return -1;
    try {
      // Decrypt the file content first
      const clearContent = await this.decryptToString(fileContent);
      const json: DatabaseType = JSON.parse(clearContent);
      const metaRows = json.data.data.find((o) => o.tableName === 'meta')?.rows;
      const lastUpdatedRow = metaRows?.find((r) => r.key === 'lastUpdated');
      return (lastUpdatedRow?.value as number) || -1;
    } catch (e) {
      console.error('Failed to get remote lastModified:', e);
      return -1;
    }
  }

  async syncNewestDB() {
    const accessToken = getAccessTokenFromCookies();
    if (!accessToken) return;
    const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, CONFIG.dataSourceFile);
    if (!fileId) return;

    const localLastModified = await getLastUpdated();
    const remoteLastModified = await this.getRemoteLastModified(accessToken, fileId);

    const isCurrentDBEmpty = await isDatabaseEmpty();

    console.info('Sync check:', {
      localLastModified,
      remoteLastModified,
      isCurrentDBEmpty,
    });

    // If local DB is empty and remote has data, import
    if (isCurrentDBEmpty && remoteLastModified > 0) {
      console.info('Import From Drive (local DB is empty, remote has data)');
      await this.importFromDrive();
      return;
    }

    // If local DB has data but remote is empty or invalid, export
    if (!isCurrentDBEmpty && remoteLastModified === -1) {
      console.info('Export To Drive (remote is empty or invalid, local has data)');
      await this.exportToDrive();
      return;
    }

    // If both are empty, do nothing
    if (isCurrentDBEmpty && remoteLastModified === -1) {
      console.info('No sync needed (both databases are empty)');
      return;
    }

    // Compare timestamps
    if (remoteLastModified > localLastModified) {
      console.info('Import From Drive (remote is newer)');
      await this.importFromDrive();
    } else if (localLastModified > remoteLastModified) {
      console.info('Export To Drive (local is newer)');
      await this.exportToDrive();
    } else {
      console.info('No sync needed (databases are in sync)');
    }
  }
}

export const googleDriveSync = GoogleDriveSync.getInstance();
