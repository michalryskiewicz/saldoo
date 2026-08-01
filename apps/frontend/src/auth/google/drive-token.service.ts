import { classifyTokenFailure, type TokenFailureReason } from './token-failure.service.ts';

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

export type RequestToken = (options: { silent: boolean }) => Promise<GoogleTokenResponse>;

/**
 * A token request that failed, carrying the code Google gave for it.
 *
 * Exists so the reason survives the trip: the bridge to Google Identity Services used to
 * flatten every failure into a bare `Error`, and everything downstream then had to guess.
 */
export class TokenRequestError extends Error {
  constructor(readonly code: string | undefined) {
    super(code ?? 'Token request failed');
    this.name = 'TokenRequestError';
  }
}

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
 * Thrown when Drive access cannot be obtained without user interaction.
 *
 * {@link reason} is the load-bearing part: only `refused` means the grant is gone and no
 * retry can help. Callers must not treat the other two as an ending — the records are on
 * this device and the vault key, not Google, is what guards them.
 */
export class DriveAuthRequiredError extends Error {
  constructor(
    readonly reason: TokenFailureReason,
    cause?: unknown
  ) {
    super(`Google Drive authorization required (${reason})`);
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
      throw new DriveAuthRequiredError(reasonOfThrown(error), error);
    }

    if (!response.access_token) {
      this.cache.clear();
      throw new DriveAuthRequiredError(classifyTokenFailure(response.error), response.error);
    }

    const expiresIn = response.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS;
    this.cache.write({
      accessToken: response.access_token,
      expiresAt: this.now() + expiresIn * 1000,
    });

    return response.access_token;
  }
}

/** A throw carries no code unless it is a {@link TokenRequestError}; anything else is weather. */
function reasonOfThrown(error: unknown): TokenFailureReason {
  return classifyTokenFailure(error instanceof TokenRequestError ? error.code : undefined);
}
