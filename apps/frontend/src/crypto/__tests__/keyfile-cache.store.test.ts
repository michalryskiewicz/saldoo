import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createIndexedDbKeyfileCache } from '../keyfile-cache.store.ts';
import { createIndexedDbDekStore } from '../dek.store.ts';
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

  it('shares a database with the cached data key without disturbing it', async () => {
    const { dek } = await FAST_VAULT();
    const dekStore = createIndexedDbDekStore(database);
    await dekStore.write(dek);

    await createIndexedDbKeyfileCache(database).write(await aKeyfile());

    await expect(dekStore.read()).resolves.not.toBeNull();
  });

  it('upgrades a database written before the cache existed without losing the key', async () => {
    database.close();
    const legacy = new Dexie('saldoo-vault');
    legacy.version(1).stores({ keys: '&id' });
    await legacy.open();
    await legacy.table('keys').put({ id: 'dek', key: (await FAST_VAULT()).dek });
    legacy.close();

    database = createVaultKeyDb();

    await expect(createIndexedDbDekStore(database).read()).resolves.not.toBeNull();
    await expect(createIndexedDbKeyfileCache(database).read()).resolves.toBeNull();
  });
});
