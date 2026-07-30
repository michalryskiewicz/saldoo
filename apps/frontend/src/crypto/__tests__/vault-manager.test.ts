import { describe, it, expect, vi } from 'vitest';
import { VaultManager, type KeyfileLookup, type KeyfileRepository } from '../vault-manager.ts';
import { VaultSession } from '../vault-session.ts';
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

function build(keyfiles = fakeKeyfiles(), keyfileCache = fakeKeyfileCache()) {
  const session = new VaultSession();
  return {
    keyfiles,
    keyfileCache,
    session,
    manager: new VaultManager(keyfiles, session, keyfileCache, FAST_VAULT),
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

  it('always asks for the passphrase on a fresh start, however recently it ran', async () => {
    // The data key is never written anywhere, so starting the app is starting from
    // locked. This is the whole point: a stolen device with the browser closed is
    // worth nothing without the passphrase.
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile));

    await expect(manager.bootstrap()).resolves.toBe('locked');
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
  it('asks for the passphrase when the keyfile is cached', async () => {
    // Unwrapping is pure crypto, so a cached keyfile is enough to unlock offline.
    const { keyfile } = await anExistingVault();
    const { manager } = build(unreachableKeyfiles(), fakeKeyfileCache(keyfile));

    await expect(manager.bootstrap()).resolves.toBe('locked');
  });

  it('reports the vault unavailable when this device has never seen a keyfile', async () => {
    const { manager } = build(unreachableKeyfiles(), fakeKeyfileCache());

    await expect(manager.bootstrap()).resolves.toBe('unavailable');
  });

  it('never offers to build a fresh vault over data it merely could not see', async () => {
    const { keyfile } = await anExistingVault();
    const { manager } = build(unreachableKeyfiles(), fakeKeyfileCache(keyfile));

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
    const { manager, keyfileCache } = build(fakeKeyfiles(null), fakeKeyfileCache(keyfile));

    await manager.bootstrap();

    expect(keyfileCache.clear).toHaveBeenCalled();
  });

  it('unlocks offline against the cached keyfile', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(unreachableKeyfiles(), fakeKeyfileCache(keyfile));

    await manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE });

    expect(session.isUnlocked()).toBe(true);
  });

  it('refuses to unlock offline with no cached keyfile', async () => {
    const { manager } = build(unreachableKeyfiles(), fakeKeyfileCache());

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
    const reopened = build(fakeKeyfiles(published.status === 'present' ? published.keyfile : null));
    await expect(reopened.manager.unlock({ kind: 'recovery-code', recoveryCode })).resolves.not.toThrow();
  });

  it('leaves the session locked when publishing the keyfile fails', async () => {
    // A device holding a key whose keyfile never reached Drive would write a backup
    // no other device could ever open.
    const keyfiles = fakeKeyfiles();
    keyfiles.save.mockRejectedValueOnce(new Error('Drive is unreachable'));
    const { manager, session } = build(keyfiles);

    await expect(manager.setUp(PASSPHRASE)).rejects.toThrow();
    expect(session.isUnlocked()).toBe(false);
  });
});

describe('VaultManager.unlock', () => {
  it('unlocks with the passphrase', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile));

    await manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE });

    expect(session.isUnlocked()).toBe(true);
  });

  it('unlocks with the recovery code', async () => {
    const { keyfile, recoveryCode } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile));

    await manager.unlock({ kind: 'recovery-code', recoveryCode });

    expect(session.isUnlocked()).toBe(true);
  });

  it('leaves the session locked on a wrong passphrase', async () => {
    const { keyfile } = await anExistingVault();
    const { manager, session } = build(fakeKeyfiles(keyfile));

    await expect(
      manager.unlock({ kind: 'passphrase', passphrase: 'wrong' })
    ).rejects.toBeInstanceOf(VaultUnlockError);
    expect(session.isUnlocked()).toBe(false);
  });

  it('refuses to unlock when there is no keyfile to open', async () => {
    const { manager } = build();

    await expect(manager.unlock({ kind: 'passphrase', passphrase: PASSPHRASE })).rejects.toThrow();
  });
});

describe('VaultManager.lock', () => {
  it('drops the session key', async () => {
    const { manager, session } = build();
    await manager.setUp(PASSPHRASE);

    await manager.lock();

    expect(session.isUnlocked()).toBe(false);
  });

  it('leaves the cached keyfile alone, so locking does not cost the offline start', async () => {
    const { manager, keyfileCache } = build();
    await manager.setUp(PASSPHRASE);

    await manager.lock();

    expect(keyfileCache.clear).not.toHaveBeenCalled();
  });
});
