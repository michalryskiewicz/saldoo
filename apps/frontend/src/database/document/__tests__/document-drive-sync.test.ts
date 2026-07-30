import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { DriveFileGateway } from '@/database/sync/drive-file.gateway.ts';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbDocumentStore } from '../document-store.ts';
import { createDocumentSession, type DocumentSession } from '../document-session.ts';
import {
  createDocumentDriveSync,
  UnreadableDocumentError,
  DOCUMENT_FILE,
} from '../document-drive-sync.ts';

/** The same shape the vault hands the sync path: a raw AES-GCM key. */
async function aDek(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/** One Drive folder both devices read and write, which is what makes this two devices. */
function sharedDrive(initial: Record<string, string> = {}) {
  const files = { ...initial };

  const gateway: DriveFileGateway = {
    readFile: vi.fn(async (name: string) => files[name] ?? null),
    writeFile: vi.fn(async (name: string, contents: string) => {
      files[name] = contents;
    }),
  } as unknown as DriveFileGateway;

  return { gateway, files };
}

function expense(id: string, description: string): DBExpense {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description,
    expense: 100,
    currency: 'PLN',
    severity: null,
  };
}

async function device(name: string, gateway: DriveFileGateway, dek: CryptoKey) {
  const session: DocumentSession = createDocumentSession({
    store: createIndexedDbDocumentStore(createDocumentDb(name)),
    database: db,
  });
  await session.open();

  return { session, sync: createDocumentDriveSync(gateway, session, () => dek) };
}

describe('document Drive sync', () => {
  let dek: CryptoKey;

  beforeEach(async () => {
    dek = await aDek();
    await Promise.all([db.expenses.clear(), db.tags.clear(), db.transactions.clear()]);
  });

  it('lets two devices keep both records instead of overwriting each other', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-laptop-${Math.random()}`, drive.gateway, dek);
    const phone = await device(`drive-phone-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await phone.session.put('expenses', expense('e2', 'Coffee'));

    await laptop.sync.sync();
    await phone.sync.sync();
    await laptop.sync.sync();

    expect(laptop.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
    expect(phone.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
  });

  it('brings the remote in and pushes the merge out in one pass', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-one-a-${Math.random()}`, drive.gateway, dek);
    const phone = await device(`drive-one-b-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await laptop.sync.sync();

    await phone.session.put('expenses', expense('e2', 'Coffee'));
    // A single sync on the phone must both take e1 and publish e2.
    await phone.sync.sync();

    expect(phone.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);

    const fresh = await device(`drive-one-c-${Math.random()}`, drive.gateway, dek);
    await fresh.sync.sync();
    expect(fresh.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
  });

  it('propagates a deletion instead of the other device restoring it', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-del-a-${Math.random()}`, drive.gateway, dek);
    const phone = await device(`drive-del-b-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await laptop.sync.sync();
    await phone.sync.sync();

    await laptop.session.remove('expenses', 'e1');
    await laptop.sync.sync();
    await phone.sync.sync();

    expect(phone.session.records('expenses')).toHaveLength(0);
  });

  it('writes its own file and never touches the pre-document backup', async () => {
    const legacy = JSON.stringify({ salt: 'c2FsdA==', iv: 'aXY=', ciphertext: 'Y3Q=' });
    const drive = sharedDrive({ 'saldoo-data.json': legacy });
    const laptop = await device(`drive-file-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await laptop.sync.sync();

    expect(drive.files['saldoo-data.json']).toBe(legacy);
    expect(drive.files[DOCUMENT_FILE]).toBeDefined();
  });

  it('starts cleanly against a Drive folder that has nothing in it yet', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-empty-${Math.random()}`, drive.gateway, dek);

    await expect(laptop.sync.sync()).resolves.toBeUndefined();
    expect(drive.files[DOCUMENT_FILE]).toBeDefined();
  });

  it('refuses an empty payload rather than treating it as a fresh account', async () => {
    const drive = sharedDrive({ [DOCUMENT_FILE]: '' });
    const laptop = await device(`drive-blank-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await expect(laptop.sync.sync()).rejects.toBeInstanceOf(UnreadableDocumentError);
  });

  it('refuses bytes it cannot parse, and leaves them where they are', async () => {
    const drive = sharedDrive({ [DOCUMENT_FILE]: 'not a payload at all' });
    const laptop = await device(`drive-junk-${Math.random()}`, drive.gateway, dek);

    await expect(laptop.sync.sync()).rejects.toBeInstanceOf(UnreadableDocumentError);
    expect(drive.gateway.writeFile).not.toHaveBeenCalled();
    expect(drive.files[DOCUMENT_FILE]).toBe('not a payload at all');
  });

  it('refuses a payload sealed with a key this device does not have', async () => {
    const drive = sharedDrive();
    const stranger = await device(`drive-other-${Math.random()}`, drive.gateway, await aDek());
    await stranger.session.put('expenses', expense('e1', 'Rent'));
    await stranger.sync.sync();

    const laptop = await device(`drive-mine-${Math.random()}`, drive.gateway, dek);

    await expect(laptop.sync.sync()).rejects.toBeInstanceOf(UnreadableDocumentError);
    expect(drive.gateway.writeFile).toHaveBeenCalledTimes(1);
  });
});
