import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteMovedOnError } from '@/database/sync/versioned-drive-file.gateway.ts';
import { encryptBytesWithDek } from '@/crypto/vault.service.ts';
import { db } from '@/database/index.ts';
import type { DBExpense } from '@/database/expenses.ts';
import type { VersionedDriveFile } from '@/database/sync/versioned-drive-file.gateway.ts';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbDocumentStore } from '../document-store.ts';
import { createDocumentSession, type DocumentSession } from '../document-session.ts';
import {
  ConcurrentWritesError,
  createDocumentDriveSync,
  MAX_SYNC_ATTEMPTS,
  UnreadableDocumentError,
  DOCUMENT_FILE,
} from '../document-drive-sync.ts';
import type { RemoteVersionStore } from '../remote-version.store.ts';

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

/**
 * One Drive folder both devices read and write, which is what makes this two devices.
 *
 * Versions behave as Drive's do: one counter per folder that only ever goes up, bumped on
 * every write. That is enough for a precondition to be either satisfied or not.
 */
function sharedDrive(initial: Record<string, string> = {}) {
  const files = { ...initial };
  const versions: Record<string, string> = {};
  let counter = 0;

  for (const name of Object.keys(files)) versions[name] = String(++counter);

  const gateway: VersionedDriveFile = {
    read: vi.fn(async (name: string, knownVersion: string | null) => {
      if (!(name in files)) return { status: 'absent' } as const;

      const version = versions[name];
      if (knownVersion !== null && knownVersion === version) {
        return { status: 'unchanged', version } as const;
      }

      return { status: 'content', content: files[name], version } as const;
    }),

    write: vi.fn(async (name: string, contents: string, expectedVersion: string | null) => {
      const current = name in files ? versions[name] : null;
      if (current !== expectedVersion) {
        throw new RemoteMovedOnError(expectedVersion, current);
      }

      files[name] = contents;
      versions[name] = String(++counter);

      return versions[name];
    }),
  };

  /** Somebody else's write, landing without this device knowing. */
  const writeBehindOurBack = (name: string, contents: string) => {
    files[name] = contents;
    versions[name] = String(++counter);
  };

  return { gateway, files, versions, writeBehindOurBack };
}

/** The token store, in memory — durability is the store's own test, not this one's. */
function versionStore(): RemoteVersionStore {
  const held = new Map<string, string>();

  return {
    read: async (fileName) => held.get(fileName) ?? null,
    write: async (fileName, version) => void held.set(fileName, version),
    forget: async (fileName) => void held.delete(fileName),
  };
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

async function device(name: string, gateway: VersionedDriveFile, dek: CryptoKey) {
  const session: DocumentSession = createDocumentSession({
    store: createIndexedDbDocumentStore(createDocumentDb(name)),
    database: db,
  });
  await session.open();

  return {
    session,
    sync: createDocumentDriveSync(gateway, session, () => dek, versionStore()),
  };
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
    expect(drive.gateway.write).not.toHaveBeenCalled();
    expect(drive.files[DOCUMENT_FILE]).toBe('not a payload at all');
  });

  it('refuses a payload sealed with a key this device does not have', async () => {
    const drive = sharedDrive();
    const stranger = await device(`drive-other-${Math.random()}`, drive.gateway, await aDek());
    await stranger.session.put('expenses', expense('e1', 'Rent'));
    await stranger.sync.sync();

    const laptop = await device(`drive-mine-${Math.random()}`, drive.gateway, dek);

    await expect(laptop.sync.sync()).rejects.toBeInstanceOf(UnreadableDocumentError);
    expect(drive.gateway.write).toHaveBeenCalledTimes(1);
  });

  it('re-merges and republishes when another device writes between the read and the write', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-race-a-${Math.random()}`, drive.gateway, dek);
    const phone = await device(`drive-race-b-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await phone.session.put('expenses', expense('e2', 'Coffee'));

    // The phone completes a whole sync of its own *after* the laptop has read and decided
    // what to publish, which is the window merging alone cannot close.
    const write = drive.gateway.write;
    let interfered = false;
    drive.gateway.write = async (name, content, expectedVersion) => {
      if (!interfered) {
        interfered = true;
        await phone.sync.sync();
      }

      return write(name, content, expectedVersion);
    };

    await laptop.sync.sync();

    expect(interfered).toBe(true);
    expect(laptop.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);

    // What matters is Drive, not this device's memory of it: a third device must find both.
    drive.gateway.write = write;
    const fresh = await device(`drive-race-c-${Math.random()}`, drive.gateway, dek);
    await fresh.sync.sync();
    expect(fresh.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
  });

  it('repairs a write of its own that landed on top of another device\'s', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-clobber-a-${Math.random()}`, drive.gateway, dek);
    const phone = await device(`drive-clobber-b-${Math.random()}`, drive.gateway, dek);

    await laptop.session.put('expenses', expense('e1', 'Rent'));
    await phone.session.put('expenses', expense('e2', 'Coffee'));

    // The phone's state as it stood before the laptop published — so this write absorbs
    // nothing of the laptop's, which is precisely a clobber. Nothing before the upload can
    // catch it: the version the laptop checked was still current when it looked.
    const phonePayload = JSON.stringify(await encryptBytesWithDek(dek, phone.session.encode()));

    const write = drive.gateway.write;
    let interfered = false;
    drive.gateway.write = async (name, content, expectedVersion) => {
      const published = await write(name, content, expectedVersion);
      if (!interfered) {
        interfered = true;
        drive.writeBehindOurBack(name, phonePayload);
      }

      return published;
    };

    await laptop.sync.sync();
    drive.gateway.write = write;

    expect(interfered).toBe(true);

    // The laptop noticed on reading back, took the phone's update, and published both.
    const fresh = await device(`drive-clobber-c-${Math.random()}`, drive.gateway, dek);
    await fresh.sync.sync();
    expect(fresh.session.records('expenses').map((r) => r.id).sort()).toEqual(['e1', 'e2']);
  });

  it('does not download a remote that has not moved since this device last saw it', async () => {
    const drive = sharedDrive();
    const store = versionStore();
    const session: DocumentSession = createDocumentSession({
      store: createIndexedDbDocumentStore(createDocumentDb(`drive-cache-${Math.random()}`)),
      database: db,
    });
    await session.open();
    const sync = createDocumentDriveSync(drive.gateway, session, () => dek, store);

    await session.put('expenses', expense('e1', 'Rent'));
    await sync.sync();

    const downloadsAfterFirst = vi
      .mocked(drive.gateway.read)
      .mock.results.filter((result) => (result.value as { status?: string })?.status === 'content')
      .length;

    await sync.sync();

    const downloads = vi
      .mocked(drive.gateway.read)
      .mock.results.filter((result) => (result.value as { status?: string })?.status === 'content')
      .length;

    // The stored version answered the question, so the contents were never fetched to
    // answer it again. Held only in memory this would fail after every reload.
    expect(downloads).toBe(downloadsAfterFirst);
    await expect(store.read(DOCUMENT_FILE)).resolves.not.toBeNull();
  });

  it('gives up after a bounded number of passes when the remote keeps moving', async () => {
    const drive = sharedDrive();
    const laptop = await device(`drive-bounded-${Math.random()}`, drive.gateway, dek);
    await laptop.session.put('expenses', expense('e1', 'Rent'));

    // Somebody writes before every single attempt, so no precondition ever holds. The
    // payload is readable on purpose: an unreadable one would halt the pass for a different
    // reason and this test would stop being about the bound.
    const interference = JSON.stringify(await encryptBytesWithDek(dek, laptop.session.encode()));
    const write = drive.gateway.write;
    let attempts = 0;
    drive.gateway.write = async (name, content, expectedVersion) => {
      attempts += 1;
      drive.writeBehindOurBack(name, interference);

      return write(name, content, expectedVersion);
    };

    await expect(laptop.sync.sync()).rejects.toBeInstanceOf(ConcurrentWritesError);
    expect(attempts).toBe(MAX_SYNC_ATTEMPTS);

    // Nothing was lost by giving up: the record is still here and still owed to Drive.
    expect(laptop.session.records('expenses').map((r) => r.id)).toEqual(['e1']);
  });
});
