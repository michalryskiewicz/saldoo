import { describe, expect, it } from 'vitest';
import { DriveAuthRequiredError } from '@/auth/google/drive-token.service.ts';
import { DriveUnreachableError } from '@/database/sync/drive-file.gateway.ts';
import { DriveRequestFailedError } from '@/database/sync/googleDriveUtils.ts';
import { RemoteDecryptionError, UnreadableBackupError } from '@/database/sync/vault-drive-sync.ts';
import { classifyUploadFailure } from '../upload-failure.service.ts';

/** Drive failures reach the outbox wrapped, so the classifier reads through the cause. */
const unreachable = (cause?: unknown) => new DriveUnreachableError(cause);

describe('classify upload failure', () => {
  it('treats being offline as transient — it clears on its own', () => {
    expect(classifyUploadFailure(unreachable(new TypeError('Failed to fetch')))).toBe('transient');
  });

  it('treats a rate limit as transient, because waiting is exactly the fix', () => {
    expect(classifyUploadFailure(unreachable(new DriveRequestFailedError(429)))).toBe('transient');
  });

  it('treats a Drive outage as transient', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyUploadFailure(unreachable(new DriveRequestFailedError(status))), `${status}`).toBe(
        'transient',
      );
    }
  });

  it('treats a timeout as transient', () => {
    expect(classifyUploadFailure(unreachable(new DriveRequestFailedError(408)))).toBe('transient');
  });

  it('treats needing authorization as transient — silent renewal may succeed later', () => {
    const needsPerson = () => new DriveAuthRequiredError('needs-interaction');
    expect(classifyUploadFailure(unreachable(needsPerson()))).toBe('transient');
    expect(classifyUploadFailure(needsPerson())).toBe('transient');
  });

  it('treats being unable to ask as transient — a dead network clears by itself', () => {
    expect(classifyUploadFailure(new DriveAuthRequiredError('unavailable'))).toBe('transient');
  });

  it('treats a withdrawn grant as permanent — retrying it forever is how it stayed silent', () => {
    // The defect this replaces: every authorization failure was transient, so a revoked
    // grant sat in the outbox retrying until the tab closed, telling nobody.
    const refused = () => new DriveAuthRequiredError('refused');
    expect(classifyUploadFailure(unreachable(refused()))).toBe('permanent');
    expect(classifyUploadFailure(refused())).toBe('permanent');
  });

  it('treats a rejected request as permanent — retrying sends the same rejected bytes', () => {
    for (const status of [400, 403, 404]) {
      expect(classifyUploadFailure(unreachable(new DriveRequestFailedError(status))), `${status}`).toBe(
        'permanent',
      );
    }
  });

  it('treats a backup it cannot read as permanent — only the user can clear it', () => {
    expect(classifyUploadFailure(new UnreadableBackupError())).toBe('permanent');
    expect(classifyUploadFailure(new RemoteDecryptionError())).toBe('permanent');
  });

  it('defaults an unrecognised failure to transient', () => {
    // Deliberate: retrying behind a five-minute ceiling costs little, while calling an
    // unknown failure permanent strands the user's data locally under a message that
    // tells them to act on something nobody diagnosed.
    expect(classifyUploadFailure(new Error('something nobody has seen before'))).toBe('transient');
    expect(classifyUploadFailure(undefined)).toBe('transient');
  });
});
