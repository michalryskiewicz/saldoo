export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

export type RequestToken = (options: { silent: boolean }) => Promise<GoogleTokenResponse>;

export type TokenSnapshot = {
  accessToken: string;
  expiresAt: number;
};

export interface TokenCache {
  read(): TokenSnapshot | null;
  write(snapshot: TokenSnapshot): void;
  clear(): void;
}

/**
 * Renew this long before the token actually dies, so an in-flight Drive request
 * can never race the expiry.
 */
export const EXPIRY_MARGIN_MS = 60_000;

const DEFAULT_EXPIRES_IN_SECONDS = 3600;

/**
 * Thrown when Drive access cannot be obtained without user interaction —
 * the caller should surface the "connect" affordance instead of failing silently.
 */
export class DriveAuthRequiredError extends Error {
  constructor(cause?: unknown) {
    super('Google Drive authorization required');
    this.name = 'DriveAuthRequiredError';
    this.cause = cause;
  }
}

/**
 * Owns the lifetime of the Google Drive access token.
 *
 * The token is never persisted server-side: it is requested straight from Google
 * by the browser and cached only for its own lifetime. Because the Drive scope is
 * granted during login, renewal is expected to succeed without any user
 * interaction; when it does not, {@link DriveAuthRequiredError} is raised and the
 * user re-consents through {@link connect}.
 */
export class DriveTokenService {
  constructor(
    private readonly requestToken: RequestToken,
    private readonly cache: TokenCache,
    private readonly now: () => number = Date.now
  ) {}

  async getAccessToken(): Promise<string> {
    const cached = this.cache.read();
    if (cached && this.isFresh(cached)) return cached.accessToken;

    return this.fetchToken({ silent: true });
  }

  async connect(): Promise<string> {
    return this.fetchToken({ silent: false });
  }

  hasFreshToken(): boolean {
    const cached = this.cache.read();
    return !!cached && this.isFresh(cached);
  }

  disconnect(): void {
    this.cache.clear();
  }

  private isFresh(snapshot: TokenSnapshot): boolean {
    return snapshot.expiresAt - EXPIRY_MARGIN_MS > this.now();
  }

  private async fetchToken(options: { silent: boolean }): Promise<string> {
    let response: GoogleTokenResponse;

    try {
      response = await this.requestToken(options);
    } catch (error) {
      this.cache.clear();
      throw new DriveAuthRequiredError(error);
    }

    if (!response.access_token) {
      this.cache.clear();
      throw new DriveAuthRequiredError(response.error);
    }

    const expiresIn = response.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS;
    this.cache.write({
      accessToken: response.access_token,
      expiresAt: this.now() + expiresIn * 1000,
    });

    return response.access_token;
  }
}
