import { describe, it, expect, vi } from 'vitest';
import { VaultManager, type KeyfileLookup, type KeyfileRepository } from '../vault-manager.ts';
import { VaultSession } from '../vault-session.ts';
import type { DekStore } from '../dek.store.ts';
import type { KeyfileCache } from '../keyfile-cache.store.ts';
import { createVault, VaultUnlockError, type Keyfile } from '../vault.service.ts';

const PASSPHRASE = 'a decent passphrase';
const FAST_VAULT: typeof createVault = (options) =>
  createVault({ ...options, passphraseIterations: 1_000, recoveryCodeIterations: 1_000 });

function fakeKeyfiles(initial: Keyfile | null = null) {
  let stored = initial;
  return {
    load: vi.fn(
      async (): Promise<KeyfileLookup> =>
        stored ? { status: 'present', keyfile: stored } : { status: 'absent' }
    ),
    save: vi.fn(async (keyfile: Keyfile) => {
      stored = keyfile;
    }),
  } satisfies KeyfileRepository;
}

function unreachableKeyfiles() {
  return {
    load: vi.fn(async (): Promise<KeyfileLookup> => ({ status: 'unreachable' })),
    save: vi.fn(async () => {}),
  } satisfies KeyfileRepository;
}

function fakeDekStore(initial: CryptoKey | null = null) {
  let stored = initial;
  return {
    read: vi.fn(async () => stored),
    write: vi.fn(async (dek: CryptoKey) => {
      stored = dek;
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
  } satisfies DekStore;
}

function fakeKeyfileCache(initial: Keyfile | null = null) {
  let stored = initial;
  return {
    read: vi.fn(async () => stored),
    write: vi.fn(async (keyfile: Keyfile) => {
      stored = keyfile;
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
  } satisfies KeyfileCache;
}

function build(
  keyfiles = fakeKeyfiles(),
  dekStore = fakeDekStore(),
  keyfileCache = fakeKeyfileCache()
) {
  const session = new VaultSession();
  return {
    keyfiles,
    dekStore,
    keyfileCache,
    session,
    manager: new VaultManager(keyfiles, dekStore, session, keyfileCache, FAST_VAULT),
  };
}

async function anExistingVault() {
  const { keyfile, dek, recoveryCode } = await FAST_VAULT({ passphrase: PASSPHRASE });
  return { keyfile, dek, recoveryCode };
}

describe('VaultManager.bootstrap', () => {
  it('asks for setup when Drive holds no keyfile', async () => {
    const { manager } = build();

    await expect(manager.bootstrap()).resolves.toBe('needs-setup');
  });

  it('unlocks straight away when this device has a cached key', async () => {
    const { keyfile, dek } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile), fakeDekStore(dek));

    await expect(manager.bootstrap()).resolves.toBe('unlocked');
    expect(session.requireDek()).toBe(dek);
  });

  it('asks for the passphrase on a device with no cached key', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile), fakeDekStore());

    await expect(manager.bootstrap()).resolves.toBe('locked');
    expect(session.isUnlocked()).toBe(false);
  });

  it('discards a cached key whose vault no longer exists on Drive', async () => {
    const { dek } = await anExistingVault();
    const dekStore = fakeDekStore(dek);
    const { manager } = build(fakeKeyfiles(null), dekStore);

    await expect(manager.bootstrap()).resolves.toBe('needs-setup');
    expect(dekStore.clear).toHaveBeenCalled();
    await expect(dekStore.read()).resolves.toBeNull();
  });

  it('never reports unlocked on the strength of a cached key alone', async () => {
    const { dek } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(null), fakeDekStore(dek));

    await manager.bootstrap();

    expect(session.isUnlocked()).toBe(false);
  });

  it('lets a corrupt keyfile surface instead of offering a fresh vault', async () => {
    const keyfiles = fakeKeyfiles();
    keyfiles.load.mockRejectedValueOnce(new Error('CorruptKeyfileError'));
    const { manager } = build(keyfiles);

    await expect(manager.bootstrap()).rejects.toThrow();
  });
});

describe('VaultManager.bootstrap when Drive cannot be reached', () => {
  it('unlocks from cached keyfile and cached key', async () => {
    const { keyfile, dek } = await anExistingVault();
    const { manager, session } = build(
      unreachableKeyfiles(),
      fakeDekStore(dek),
      fakeKeyfileCache(keyfile)
    );

    await expect(manager.bootstrap()).resolves.toBe('unlocked');
    expect(session.requireDek()).toBe(dek);
  });

  it('asks for the passphrase when only the keyfile is cached', async () => {
    // Unwrapping is pure crypto, so a cached keyfile is enough to unlock offline.
    const { keyfile } = await anExistingVault();
    const { manager } = build(unreachableKeyfiles(), fakeDekStore(), fakeKeyfileCache(keyfile));

    await expect(manager.bootstrap()).resolves.toBe('locked');
  });

  it('reports the vault unavailable when this device has never seen a keyfile', async () => {
    const { manager } = build(unreachableKeyfiles(), fakeDekStore(), fakeKeyfileCache());

    await expect(manager.bootstrap()).resolves.toBe('unavailable');
  });

  it('never clears the cached key on an answer it could not obtain', async () => {
    const { dek } = await anExistingVault();
    const dekStore = fakeDekStore(dek);
    const { manager } = build(unreachableKeyfiles(), dekStore, fakeKeyfileCache());

    await manager.bootstrap();

    expect(dekStore.clear).not.toHaveBeenCalled();
    await expect(dekStore.read()).resolves.toBe(dek);
  });

  it('never offers to build a fresh vault over data it merely could not see', async () => {
    const { keyfile, dek } = await anExistingVault();
    const { manager } = build(
      unreachableKeyfiles(),
      fakeDekStore(dek),
      fakeKeyfileCache(keyfile)
    );

    await expect(manager.bootstrap()).resolves.not.toBe('needs-setup');
  });
});

describe('VaultManager keyfile caching', () => {
  it('caches the keyfile Drive returned so the next start can be offline', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, keyfileCache } = build(fakeKeyfiles(keyfile));

    await manager.bootstrap();

    expect(keyfileCache.write).toHaveBeenCalledWith(keyfile);
  });

  it('caches the keyfile it publishes at setup', async () => {
    const { manager, keyfileCache } = build();

    await manager.setUp(PASSPHRASE);

    expect(keyfileCache.write).toHaveBeenCalledOnce();
  });

  it('forgets the cached keyfile once Drive says the vault is gone', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, keyfileCache } = build(
      fakeKeyfiles(null),
      fakeDekStore(),
      fakeKeyfileCache(keyfile)
    );

    await manager.bootstrap();

    expect(keyfileCache.clear).toHaveBeenCalled();
  });

  it('unlocks offline against the cached keyfile', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(
      unreachableKeyfiles(),
      fakeDekStore(),
      fakeKeyfileCache(keyfile)
    );

    await manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE });

    expect(session.isUnlocked()).toBe(true);
  });

  it('refuses to unlock offline with no cached keyfile', async () => {
    const { manager } = build(unreachableKeyfiles(), fakeDekStore(), fakeKeyfileCache());

    await expect(manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE })).rejects.toThrow();
  });
});

describe('VaultManager.setUp', () => {
  it('publishes the keyfile and unlocks the session', async () => {
    const { manager, keyfiles, session } = build();

    await manager.setUp(PASSPHRASE);

    expect(keyfiles.save).toHaveBeenCalledOnce();
    expect(session.isUnlocked()).toBe(true);
  });

  it('returns a recovery code that opens the published vault', async () => {
    const { manager, keyfiles } = build();

    const recoveryCode = await manager.setUp(PASSPHRASE);

    const published = await keyfiles.load();
    expect(published.status).toBe('present');
    const reopened = build(
      fakeKeyfiles(published.status === 'present' ? published.keyfile : null),
      fakeDekStore()
    );
    await expect(reopened.manager.unlock({ kind: 'recovery-code', recoveryCode })).resolves.not.toThrow();
  });

  it('caches the key so the next start needs no passphrase', async () => {
    const { manager, dekStore } = build();

    await manager.setUp(PASSPHRASE);

    expect(dekStore.write).toHaveBeenCalledOnce();
  });

  it('publishes the keyfile before caching the key', async () => {
    const order: string[] = [];
    const keyfiles = fakeKeyfiles();
    keyfiles.save.mockImplementation(async () => void order.push('save-keyfile'));
    const dekStore = fakeDekStore();
    dekStore.write.mockImplementation(async () => void order.push('cache-key'));
    const { manager } = build(keyfiles, dekStore);

    await manager.setUp(PASSPHRASE);

    expect(order).toEqual(['save-keyfile', 'cache-key']);
  });

  it('does not cache a key when publishing the keyfile fails', async () => {
    const keyfiles = fakeKeyfiles();
    keyfiles.save.mockRejectedValueOnce(new Error('Drive is unreachable'));
    const dekStore = fakeDekStore();
    const { manager, session } = build(keyfiles, dekStore);

    await expect(manager.setUp(PASSPHRASE)).rejects.toThrow();
    expect(dekStore.write).not.toHaveBeenCalled();
    expect(session.isUnlocked()).toBe(false);
  });
});

describe('VaultManager.unlock', () => {
  it('unlocks with the passphrase and caches the key', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session, dekStore } = build(fakeKeyfiles(keyfile), fakeDekStore());

    await manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE });

    expect(session.isUnlocked()).toBe(true);
    expect(dekStore.write).toHaveBeenCalledOnce();
  });

  it('unlocks with the recovery code', async () => {
    const { keyfile, recoveryCode } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile), fakeDekStore());

    await manager.unlock({ kind: 'recovery-code', recoveryCode });

    expect(session.isUnlocked()).toBe(true);
  });

  it('leaves the session locked and nothing cached on a wrong passphrase', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session, dekStore } = build(fakeKeyfiles(keyfile), fakeDekStore());

    await expect(
      manager.unlock({ kind: 'passphrase', passphrase: 'wrong' })
    ).rejects.toBeInstanceOf(VaultUnlockError);
    expect(session.isUnlocked()).toBe(false);
    expect(dekStore.write).not.toHaveBeenCalled();
  });

  it('refuses to unlock when there is no keyfile to open', async () => {
    const { manager } = build();

    await expect(manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE })).rejects.toThrow();
  });
});

describe('VaultManager.lock', () => {
  it('drops both the session key and the cached one', async () => {
    const { manager, session, dekStore } = build();
    await manager.setUp(PASSPHRASE);

    await manager.lock();

    expect(session.isUnlocked()).toBe(false);
    expect(dekStore.clear).toHaveBeenCalled();
    await expect(dekStore.read()).resolves.toBeNull();
  });
});
