import { describe, it, expect, vi } from 'vitest';
import { createSessionTokenCache } from '../session-token-cache.ts';

function createStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('createSessionTokenCache', () => {
  it('round-trips a snapshot', () => {
    const cache = createSessionTokenCache(createStorage());

    cache.write({ accessToken: 'token', expiresAt: 1234 });

    expect(cache.read()).toEqual({ accessToken: 'token', expiresAt: 1234 });
  });

  it('reads null when nothing was stored', () => {
    expect(createSessionTokenCache(createStorage()).read()).toBeNull();
  });

  it('reads null when the stored value is not valid JSON', () => {
    const cache = createSessionTokenCache(createStorage({ 'saldoo.drive-token': 'not-json' }));

    expect(cache.read()).toBeNull();
  });

  it('reads null when the stored snapshot is missing fields', () => {
    const cache = createSessionTokenCache(
      createStorage({ 'saldoo.drive-token': JSON.stringify({ accessToken: 'token' }) })
    );

    expect(cache.read()).toBeNull();
  });

  it('reads null when the stored expiry is not a number', () => {
    const cache = createSessionTokenCache(
      createStorage({
        'saldoo.drive-token': JSON.stringify({ accessToken: 'token', expiresAt: 'soon' }),
      })
    );

    expect(cache.read()).toBeNull();
  });

  it('forgets the snapshot on clear', () => {
    const cache = createSessionTokenCache(createStorage());
    cache.write({ accessToken: 'token', expiresAt: 1234 });

    cache.clear();

    expect(cache.read()).toBeNull();
  });

  it('survives a storage that refuses writes', () => {
    const storage = createStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const cache = createSessionTokenCache(storage);

    expect(() => cache.write({ accessToken: 'token', expiresAt: 1234 })).not.toThrow();
    expect(cache.read()).toBeNull();
  });
});
