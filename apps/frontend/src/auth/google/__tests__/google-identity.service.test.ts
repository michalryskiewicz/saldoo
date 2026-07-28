import { describe, it, expect, vi } from 'vitest';
import {
  fetchGoogleIdentity,
  GoogleIdentityError,
  revokeGoogleToken,
} from '../google-identity.service.ts';

const respondWith = (body: unknown, ok = true, status = 200) =>
  vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

describe('fetchGoogleIdentity', () => {
  it('maps Google’s subject onto a stable user id', async () => {
    const fetchImpl = respondWith({ sub: '12345', email: 'a@b.com', name: 'Ada' });

    await expect(fetchGoogleIdentity('token', fetchImpl)).resolves.toEqual({
      id: '12345',
      email: 'a@b.com',
      name: 'Ada',
      picture: undefined,
    });
  });

  it('sends the access token as a bearer credential', async () => {
    const fetchImpl = respondWith({ sub: '1', email: 'a@b.com' });

    await fetchGoogleIdentity('the-token', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('userinfo'), {
      headers: { Authorization: 'Bearer the-token' },
    });
  });

  it('falls back to the email when Google omits the display name', async () => {
    const fetchImpl = respondWith({ sub: '1', email: 'a@b.com' });

    await expect(fetchGoogleIdentity('token', fetchImpl)).resolves.toMatchObject({ name: 'a@b.com' });
  });

  it('keeps the avatar when Google supplies one', async () => {
    const fetchImpl = respondWith({ sub: '1', email: 'a@b.com', picture: 'https://pic' });

    await expect(fetchGoogleIdentity('token', fetchImpl)).resolves.toMatchObject({
      picture: 'https://pic',
    });
  });

  it('raises when Google rejects the token', async () => {
    const fetchImpl = respondWith({}, false, 401);

    await expect(fetchGoogleIdentity('stale', fetchImpl)).rejects.toBeInstanceOf(
      GoogleIdentityError
    );
  });

  it('raises rather than inventing a user when the subject is missing', async () => {
    const fetchImpl = respondWith({ email: 'a@b.com' });

    await expect(fetchGoogleIdentity('token', fetchImpl)).rejects.toBeInstanceOf(
      GoogleIdentityError
    );
  });

  it('raises when the email is missing', async () => {
    const fetchImpl = respondWith({ sub: '1' });

    await expect(fetchGoogleIdentity('token', fetchImpl)).rejects.toBeInstanceOf(
      GoogleIdentityError
    );
  });
});

describe('revokeGoogleToken', () => {
  it('posts the token to Google’s revocation endpoint', async () => {
    const fetchImpl = respondWith({});

    await revokeGoogleToken('the-token', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('token=the-token'), {
      method: 'POST',
    });
  });

  it('url-encodes tokens containing reserved characters', async () => {
    const fetchImpl = respondWith({});

    await revokeGoogleToken('a/b+c=', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('a%2Fb%2Bc%3D'), {
      method: 'POST',
    });
  });
});
