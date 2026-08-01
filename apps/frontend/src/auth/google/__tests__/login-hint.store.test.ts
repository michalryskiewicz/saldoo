import { describe, it, expect, beforeEach } from 'vitest';
import { createLoginHintStore } from '../login-hint.store.ts';

function fakeStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => void entries.delete(key),
    setItem: (key, value) => void entries.set(key, value),
  };
}

/** A storage that refuses everything — Safari in private mode, or a full quota. */
function hostileStorage(): Storage {
  return {
    length: 0,
    clear: () => {
      throw new Error('nope');
    },
    getItem: () => {
      throw new Error('nope');
    },
    key: () => {
      throw new Error('nope');
    },
    removeItem: () => {
      throw new Error('nope');
    },
    setItem: () => {
      throw new Error('nope');
    },
  };
}

let storage: Storage;

beforeEach(() => {
  storage = fakeStorage();
});

describe('createLoginHintStore', () => {
  it('has no hint on a device that has never signed in', () => {
    expect(createLoginHintStore(storage).read()).toBeNull();
  });

  it('remembers the address it was given', () => {
    const store = createLoginHintStore(storage);

    store.remember('michal@example.com');

    expect(store.read()).toBe('michal@example.com');
  });

  it('outlives the store instance, because a new tab builds a new one', () => {
    createLoginHintStore(storage).remember('michal@example.com');

    expect(createLoginHintStore(storage).read()).toBe('michal@example.com');
  });

  it('forgets on request, which is what switching account means', () => {
    const store = createLoginHintStore(storage);
    store.remember('michal@example.com');

    store.forget();

    expect(store.read()).toBeNull();
  });

  it('ignores an empty address rather than remembering nothing as something', () => {
    const store = createLoginHintStore(storage);

    store.remember('');

    expect(store.read()).toBeNull();
  });

  it('survives a storage that refuses to answer', () => {
    const store = createLoginHintStore(hostileStorage());

    expect(() => store.remember('michal@example.com')).not.toThrow();
    expect(() => store.forget()).not.toThrow();
    expect(store.read()).toBeNull();
  });
});
