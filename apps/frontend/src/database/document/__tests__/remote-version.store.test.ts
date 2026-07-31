import { describe, expect, it } from 'vitest';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbRemoteVersionStore } from '../remote-version.store.ts';

const FILE = 'saldoo-document-v1.json';

/** A second store over the same database is what a reload looks like from here. */
const afterAReload = (name: string) => createIndexedDbRemoteVersionStore(createDocumentDb(name));

describe('remote version store', () => {
  it('reports nothing known for a file it has never seen', async () => {
    const store = afterAReload(`versions-fresh-${Math.random()}`);

    // Not an empty string, not a zero: a missing token has to mean "download", and only
    // `null` says that unambiguously.
    await expect(store.read(FILE)).resolves.toBeNull();
  });

  it('survives a reload, so an unchanged remote is not re-downloaded after one', async () => {
    const name = `versions-durable-${Math.random()}`;

    await afterAReload(name).write(FILE, '7');

    // Held only in memory this would be `null` here, and every reload would pay for a
    // download to learn the file had not changed — quietly voiding the whole optimisation.
    await expect(afterAReload(name).read(FILE)).resolves.toBe('7');
  });

  it('keeps one version per file', async () => {
    const store = afterAReload(`versions-per-file-${Math.random()}`);

    await store.write(FILE, '7');
    await store.write('saldoo-keys.json', '2');

    await expect(store.read(FILE)).resolves.toBe('7');
    await expect(store.read('saldoo-keys.json')).resolves.toBe('2');
  });

  it('forgets a file, so the next sync starts from nothing', async () => {
    const store = afterAReload(`versions-forget-${Math.random()}`);

    await store.write(FILE, '7');
    await store.forget(FILE);

    await expect(store.read(FILE)).resolves.toBeNull();
  });
});
