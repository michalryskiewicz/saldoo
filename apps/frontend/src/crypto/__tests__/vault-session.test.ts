import { describe, it, expect, vi } from 'vitest';
import { VaultLockedError, VaultSession } from '../vault-session.ts';

async function aKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

describe('VaultSession', () => {
  it('starts locked', () => {
    const session = new VaultSession();

    expect(session.isUnlocked()).toBe(false);
    expect(() => session.requireDek()).toThrow(VaultLockedError);
  });

  it('hands back the key it was unlocked with', async () => {
    const session = new VaultSession();
    const dek = await aKey();

    session.unlock(dek);

    expect(session.isUnlocked()).toBe(true);
    expect(session.requireDek()).toBe(dek);
  });

  it('forgets the key on lock', async () => {
    const session = new VaultSession();
    session.unlock(await aKey());

    session.lock();

    expect(session.isUnlocked()).toBe(false);
    expect(() => session.requireDek()).toThrow(VaultLockedError);
  });

  it('notifies subscribers when it unlocks and when it locks', async () => {
    const session = new VaultSession();
    const listener = vi.fn();
    session.subscribe(listener);

    session.unlock(await aKey());
    session.lock();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when locking an already locked session', () => {
    const session = new VaultSession();
    const listener = vi.fn();
    session.subscribe(listener);

    session.lock();

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying once unsubscribed', async () => {
    const session = new VaultSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    unsubscribe();
    session.unlock(await aKey());

    expect(listener).not.toHaveBeenCalled();
  });

  it('replaces the key when unlocked again', async () => {
    const session = new VaultSession();
    const first = await aKey();
    const second = await aKey();

    session.unlock(first);
    session.unlock(second);

    expect(session.requireDek()).toBe(second);
  });
});
