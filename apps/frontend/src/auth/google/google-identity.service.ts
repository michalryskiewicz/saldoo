const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export type GoogleIdentity = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

export class GoogleIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleIdentityError';
  }
}

type UserInfoResponse = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

/**
 * Reads who the access token belongs to.
 *
 * The same token that reaches Drive carries the `openid email profile` scopes, so
 * identity needs no second credential and no server round trip.
 *
 * @throws {GoogleIdentityError} when Google declines or answers without a subject.
 */
export async function fetchGoogleIdentity(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleIdentity> {
  const response = await fetchImpl(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GoogleIdentityError(`Google rejected the identity request (${response.status})`);
  }

  const payload = (await response.json()) as UserInfoResponse;

  if (!payload.sub || !payload.email) {
    throw new GoogleIdentityError('Google returned an identity without a subject or email');
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}

/**
 * Hands the token back to Google so signing out actually withdraws access rather
 * than only forgetting it locally.
 */
export async function revokeGoogleToken(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await fetchImpl(`${REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, { method: 'POST' });
}
