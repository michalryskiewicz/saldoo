import { beforeEach, describe, expect, it } from 'vitest';
import { createVaultKeyDb } from '../vault-key-db.ts';
import { createSessionKeyCache, SESSION_WITNESS_KEY, MAX_CACHE_AGE_MS } from '../session-key-cache.ts';

async function aDek(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** A cache on its own database and a controllable clock. */
function build(name = `keycache-${Math.random()}`, now = () => 1_000_000) {
  return {
    name,
    cache: createSessionKeyCache({ database: createVaultKeyDb(name), now }),
  };
}

/** A new browser session: the witness is gone, the database is not. */
function closeBrowser() {
  sessionStorage.removeItem(SESSION_WITNESS_KEY);
}

describe('session key cache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('has nothing to offer before the first unlock', async () => {
    const { cache } = build();
    expect(await cache.read()).toBeNull();
  });

  it('gives the key back across a reload', async () => {
    // The reason this exists: F5 used to mean typing the passphrase again, at a
    // second of PBKDF2 each time.
    const { cache, name } = build();
    const dek = await aDek();
    await cache.write(dek);

    const reloaded = build(name).cache;
    const restored = await reloaded.read();

    expect(restored).not.toBeNull();
    // Same key material: it round-trips a payload the original sealed.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, new Uint8Array([1, 2, 3]));
    const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, restored as CryptoKey, sealed);
    expect([...new Uint8Array(opened)]).toEqual([1, 2, 3]);
  });

  it('refuses the key once the browser session is gone', async () => {
    // The property worth keeping from the memory-only design: closing the browser
    // means the passphrase is required again, so a recovered machine is not open.
    const { cache, name } = build();
    await cache.write(await aDek());

    closeBrowser();

    expect(await build(name).cache.read()).toBeNull();
  });

  it('drops the stored key when it refuses it, rather than leaving it lying there', async () => {
    const { cache, name } = build();
    await cache.write(await aDek());
    closeBrowser();

    await build(name).cache.read();

    // Even with a forged witness the key must be gone, because the refusal deleted it.
    sessionStorage.setItem(SESSION_WITNESS_KEY, 'forged');
    expect(await build(name).cache.read()).toBeNull();
  });

  it('refuses a key older than the maximum age even within the same session', async () => {
    const start = 1_000_000;
    const { cache, name } = build(undefined, () => start);
    await cache.write(await aDek());

    const later = build(name, () => start + MAX_CACHE_AGE_MS + 1).cache;
    expect(await later.read()).toBeNull();
  });

  it('accepts a key that is still inside the maximum age', async () => {
    const start = 1_000_000;
    const { cache, name } = build(undefined, () => start);
    await cache.write(await aDek());

    const later = build(name, () => start + MAX_CACHE_AGE_MS - 1).cache;
    expect(await later.read()).not.toBeNull();
  });

  it('clears on demand, which is what locking uses', async () => {
    const { cache, name } = build();
    await cache.write(await aDek());

    await cache.clear();

    expect(await build(name).cache.read()).toBeNull();
  });

  it('stores a key that still cannot be exported', async () => {
    const { cache, name } = build();
    await cache.write(await aDek());

    const restored = (await build(name).cache.read()) as CryptoKey;

    expect(restored.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', restored)).rejects.toThrow();
  });
});
