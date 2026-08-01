import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DriveAuthRequiredError,
  DriveTokenService,
  TokenRequestError,
  EXPIRY_MARGIN_MS,
  type GoogleTokenResponse,
  type TokenCache,
  type TokenSnapshot,
} from '../drive-token.service.ts';

function createCache(initial: TokenSnapshot | null = null): TokenCache {
  let snapshot = initial;
  return {
    read: () => snapshot,
    write: (next) => {
      snapshot = next;
    },
    clear: () => {
      snapshot = null;
    },
  };
}

describe('DriveTokenService', () => {
  const NOW = 1_000_000;
  let now: () => number;

  beforeEach(() => {
    now = () => NOW;
  });

  it('returns the cached token without contacting Google when it is still fresh', async () => {
    const requestToken = vi.fn<() => Promise<GoogleTokenResponse>>();
    const cache = createCache({ accessToken: 'cached-token', expiresAt: NOW + 10 * 60 * 1000 });
    const service = new DriveTokenService(requestToken, cache, now);

    await expect(service.getAccessToken()).resolves.toBe('cached-token');
    expect(requestToken).not.toHaveBeenCalled();
  });

  it('renews silently when there is no cached token', async () => {
    const requestToken = vi.fn(async () => ({ access_token: 'fresh-token', expires_in: 3600 }));
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).resolves.toBe('fresh-token');
    expect(requestToken).toHaveBeenCalledWith({ silent: true });
  });

  it('caches the renewed token with an absolute expiry derived from expires_in', async () => {
    const requestToken = vi.fn(async () => ({ access_token: 'fresh-token', expires_in: 3600 }));
    const cache = createCache();
    const service = new DriveTokenService(requestToken, cache, now);

    await service.getAccessToken();

    expect(cache.read()).toEqual({
      accessToken: 'fresh-token',
      expiresAt: NOW + 3_600_000,
    });
  });

  it('renews a token that is still valid but inside the expiry margin', async () => {
    const requestToken = vi.fn(async () => ({ access_token: 'renewed-token', expires_in: 3600 }));
    const cache = createCache({
      accessToken: 'about-to-die',
      expiresAt: NOW + EXPIRY_MARGIN_MS - 1,
    });
    const service = new DriveTokenService(requestToken, cache, now);

    await expect(service.getAccessToken()).resolves.toBe('renewed-token');
    expect(requestToken).toHaveBeenCalledWith({ silent: true });
  });

  it('raises DriveAuthRequiredError when the silent renewal rejects', async () => {
    const requestToken = vi.fn(async () => {
      throw new Error('popup_closed');
    });
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toBeInstanceOf(DriveAuthRequiredError);
  });

  it('raises DriveAuthRequiredError when Google answers without an access token', async () => {
    const requestToken = vi.fn(async () => ({ error: 'interaction_required' }));
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toBeInstanceOf(DriveAuthRequiredError);
  });

  it('drops the stale cache entry when renewal fails', async () => {
    const cache = createCache({ accessToken: 'expired', expiresAt: NOW - 1 });
    const requestToken = vi.fn(async () => ({ error: 'interaction_required' }));
    const service = new DriveTokenService(requestToken, cache, now);

    await expect(service.getAccessToken()).rejects.toBeInstanceOf(DriveAuthRequiredError);
    expect(cache.read()).toBeNull();
  });

  it('requests an interactive token when connecting explicitly', async () => {
    const requestToken = vi.fn(async () => ({ access_token: 'consented-token', expires_in: 3600 }));
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.connect()).resolves.toBe('consented-token');
    expect(requestToken).toHaveBeenCalledWith({ silent: false });
  });

  it('falls back to a one hour lifetime when Google omits expires_in', async () => {
    const requestToken = vi.fn(async () => ({ access_token: 'fresh-token' }));
    const cache = createCache();
    const service = new DriveTokenService(requestToken, cache, now);

    await service.getAccessToken();

    expect(cache.read()?.expiresAt).toBe(NOW + 3_600_000);
  });

  it('reports connection state from the cache without triggering a renewal', () => {
    const requestToken = vi.fn<() => Promise<GoogleTokenResponse>>();
    const fresh = new DriveTokenService(
      requestToken,
      createCache({ accessToken: 't', expiresAt: NOW + 10 * 60 * 1000 }),
      now
    );
    const stale = new DriveTokenService(
      requestToken,
      createCache({ accessToken: 't', expiresAt: NOW - 1 }),
      now
    );

    expect(fresh.hasFreshToken()).toBe(true);
    expect(stale.hasFreshToken()).toBe(false);
    expect(requestToken).not.toHaveBeenCalled();
  });

  it('forgets the token on disconnect', async () => {
    const cache = createCache({ accessToken: 't', expiresAt: NOW + 10 * 60 * 1000 });
    const service = new DriveTokenService(vi.fn(), cache, now);

    service.disconnect();

    expect(service.hasFreshToken()).toBe(false);
    expect(cache.read()).toBeNull();
  });

  // === Why the renewal failed ===
  //
  // Every failure used to arrive as one undifferentiated error, so a withdrawn grant
  // retried forever in silence while a dropped connection was treated as gravely.

  it('carries a refusal as a refusal', async () => {
    const requestToken = vi.fn(async () => ({ error: 'access_denied' }));
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toMatchObject({ reason: 'refused' });
  });

  it('carries a silent renewal that needs the person as needing interaction', async () => {
    const requestToken = vi.fn(async () => ({ error: 'interaction_required' }));
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toMatchObject({ reason: 'needs-interaction' });
  });

  it('reads the code off a thrown TokenRequestError rather than losing it', async () => {
    const requestToken = vi.fn(async () => {
      throw new TokenRequestError('popup_failed_to_open');
    });
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('treats a throw it cannot read as unavailable, never as a refusal', async () => {
    const requestToken = vi.fn(async () => {
      throw new Error('the network, probably');
    });
    const service = new DriveTokenService(requestToken, createCache(), now);

    await expect(service.getAccessToken()).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
