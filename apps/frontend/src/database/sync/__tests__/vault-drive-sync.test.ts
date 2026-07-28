import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteDecryptionError, VaultDriveSync } from '../vault-drive-sync.ts';
import type { DriveFileGateway } from '../drive-file.gateway.ts';
import type { LocalSnapshotStore } from '../local-snapshot.store.ts';
import { encryptWithDek } from '@/crypto/vault.service.ts';

const DATA_FILE = 'saldoo-data.json';

const snapshotJson = (lastUpdated: number) =>
  JSON.stringify({
    data: {
      databaseName: 'saldoo',
      databaseVersion: 2,
      data: [{ inbound: true, tableName: 'meta', rows: [{ key: 'lastUpdated', value: lastUpdated }] }],
    },
    name: 'saldoo',
    formatVersion: 1,
  });

async function aDek(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

function fakeDrive(files: Record<string, string> = {}) {
  return {
    files,
    gateway: {
      readFile: vi.fn(async (name: string) => files[name] ?? null),
      writeFile: vi.fn(async (name: string, content: string) => {
        files[name] = content;
      }),
    } satisfies DriveFileGateway,
  };
}

function fakeLocal(overrides: Partial<LocalSnapshotStore> = {}) {
  return {
    isEmpty: vi.fn(async () => false),
    lastUpdated: vi.fn(async () => 1_000),
    exportSnapshot: vi.fn(async () => snapshotJson(1_000)),
    importSnapshot: vi.fn(async () => {}),
    ...overrides,
  } satisfies LocalSnapshotStore;
}

describe('VaultDriveSync', () => {
  let dek: CryptoKey;

  beforeEach(async () => {
    dek = await aDek();
  });

  describe('exportToDrive', () => {
    it('writes an encrypted payload, never the snapshot itself', async () => {
      const drive = fakeDrive();
      const local = fakeLocal();
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await sync.exportToDrive();

      const written = drive.files[DATA_FILE];
      expect(written).not.toContain('lastUpdated');
      expect(JSON.parse(written)).toMatchObject({
        formatVersion: expect.any(Number),
        iv: expect.any(String),
        ciphertext: expect.any(String),
      });
    });

    it('refuses to overwrite the backup with an empty database', async () => {
      const drive = fakeDrive();
      const local = fakeLocal({ isEmpty: vi.fn(async () => true) });
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await sync.exportToDrive();

      expect(drive.gateway.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('importFromDrive', () => {
    it('decrypts the backup and hands the snapshot to the local store', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(2_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const local = fakeLocal();
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await sync.importFromDrive();

      expect(local.importSnapshot).toHaveBeenCalledWith(snapshotJson(2_000));
    });

    it('does nothing when Drive holds no backup', async () => {
      const local = fakeLocal();
      const sync = new VaultDriveSync(fakeDrive().gateway, local, () => dek, DATA_FILE);

      await sync.importFromDrive();

      expect(local.importSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('syncNewestDB', () => {
    it('imports when the backup is newer than this device', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(5_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const local = fakeLocal({ lastUpdated: vi.fn(async () => 1_000) });
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('import');
      expect(local.importSnapshot).toHaveBeenCalledWith(snapshotJson(5_000));
    });

    it('exports when this device is newer than the backup', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(1_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const local = fakeLocal({ lastUpdated: vi.fn(async () => 9_000) });
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('export');
      expect(drive.gateway.writeFile).toHaveBeenCalled();
    });

    it('does nothing when both sides are at the same revision', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(1_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const local = fakeLocal({ lastUpdated: vi.fn(async () => 1_000) });
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('none');
      expect(local.importSnapshot).not.toHaveBeenCalled();
      expect(drive.gateway.writeFile).not.toHaveBeenCalled();
    });

    it('reads Drive once, not once per decision branch', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(5_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const sync = new VaultDriveSync(drive.gateway, fakeLocal(), () => dek, DATA_FILE);

      await sync.syncNewestDB();

      expect(drive.gateway.readFile).toHaveBeenCalledTimes(1);
    });

    it('replaces a pre-vault backup instead of choking on it', async () => {
      const legacy = JSON.stringify({ salt: 'c2FsdA==', iv: 'aXY=', ciphertext: 'Y3Q=' });
      const drive = fakeDrive({ [DATA_FILE]: legacy });
      const sync = new VaultDriveSync(drive.gateway, fakeLocal(), () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('export');
      expect(drive.gateway.writeFile).toHaveBeenCalled();
    });

    it('refuses to overwrite a current backup it cannot decrypt', async () => {
      const payload = await encryptWithDek(await aDek(), snapshotJson(5_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const sync = new VaultDriveSync(drive.gateway, fakeLocal(), () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).rejects.toBeInstanceOf(RemoteDecryptionError);
      expect(drive.gateway.writeFile).not.toHaveBeenCalled();
    });

    it('exports onto an empty Drive folder', async () => {
      const drive = fakeDrive({ [DATA_FILE]: '' });
      const sync = new VaultDriveSync(drive.gateway, fakeLocal(), () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('export');
    });

    it('imports onto a fresh device even though its clock says otherwise', async () => {
      const payload = await encryptWithDek(dek, snapshotJson(1_000));
      const drive = fakeDrive({ [DATA_FILE]: JSON.stringify(payload) });
      const local = fakeLocal({
        isEmpty: vi.fn(async () => true),
        lastUpdated: vi.fn(async () => 9_999),
      });
      const sync = new VaultDriveSync(drive.gateway, local, () => dek, DATA_FILE);

      await expect(sync.syncNewestDB()).resolves.toBe('import');
    });
  });
});
