import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createIndexedDbKeyfileCache } from '../keyfile-cache.store.ts';
import { createVaultKeyDb, type VaultKeyDB } from '../vault-key-db.ts';
import { createVault } from '../vault.service.ts';

const FAST_VAULT = () =>
  createVault({
    passphrase: 'test passphrase',
    passphraseIterations: 1_000,
    recoveryCodeIterations: 1_000,
  });

const aKeyfile = async () => (await FAST_VAULT()).keyfile;

let database: VaultKeyDB;

beforeEach(async () => {
  await Dexie.delete('saldoo-vault');
  database = createVaultKeyDb();
});

afterEach(() => {
  database.close();
});

describe('createIndexedDbKeyfileCache', () => {
  it('reports nothing before a keyfile has been cached', async () => {
    await expect(createIndexedDbKeyfileCache(database).read()).resolves.toBeNull();
  });

  it('round-trips a keyfile', async () => {
    const keyfile = await aKeyfile();
    const cache = createIndexedDbKeyfileCache(database);

    await cache.write(keyfile);

    await expect(cache.read()).resolves.toEqual(keyfile);
  });

  it('keeps only the most recent keyfile', async () => {
    const cache = createIndexedDbKeyfileCache(database);

    await cache.write(await aKeyfile());
    const newest = await aKeyfile();
    await cache.write(newest);

    await expect(cache.read()).resolves.toEqual(newest);
  });

  it('forgets the keyfile on clear', async () => {
    const cache = createIndexedDbKeyfileCache(database);
    await cache.write(await aKeyfile());

    await cache.clear();

    await expect(cache.read()).resolves.toBeNull();
  });

  it('keeps no table for a data key, so none can be written to disk', async () => {
    await createIndexedDbKeyfileCache(database).write(await aKeyfile());

    expect(database.tables.map((table) => table.name)).not.toContain('keys');
  });

  it('deletes a data key that an older version left on this device', async () => {
    // Upgrading has to actively remove it. Leaving the key behind would mean the
    // release that stopped persisting the key still shipped every existing user's
    // key sitting unlocked on their disk.
    database.close();
    const legacy = new Dexie('saldoo-vault');
    legacy.version(1).stores({ keys: '&id' });
    await legacy.open();
    await legacy.table('keys').put({ id: 'dek', key: (await FAST_VAULT()).dek });
    legacy.close();

    database = createVaultKeyDb();
    await database.open();

    expect(database.tables.map((table) => table.name)).not.toContain('keys');
    expect(database.verno).toBeGreaterThanOrEqual(3);
  });

  it('survives that upgrade with the cached keyfile still usable', async () => {
    const keyfile = await aKeyfile();
    await createIndexedDbKeyfileCache(database).write(keyfile);
    database.close();

    database = createVaultKeyDb();

    await expect(createIndexedDbKeyfileCache(database).read()).resolves.toEqual(keyfile);
  });
});
