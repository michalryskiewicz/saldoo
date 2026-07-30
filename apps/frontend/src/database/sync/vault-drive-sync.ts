import { CONFIG } from '@/global-config.ts';
import { decryptWithDek, encryptWithDek, type EncryptedPayload } from '@/crypto/vault.service.ts';
import type { DriveFileGateway } from '@/database/sync/drive-file.gateway.ts';
import type { LocalSnapshotStore } from '@/database/sync/local-snapshot.store.ts';
import { readLastUpdatedFromSnapshot } from '@/database/sync/remote-snapshot.service.ts';
import {
  decideSync,
  NO_REMOTE_TIMESTAMP,
  type SyncDecision,
} from '@/database/sync/sync-decision.service.ts';

/**
 * Raised when Drive holds a backup written in the current format that this data key
 * cannot open.
 *
 * This must never be softened into "there is no backup": that verdict makes the
 * sync export over the file, destroying a backup whose key the user may still
 * recover. Refusing to proceed is the safe outcome.
 */
export class RemoteDecryptionError extends Error {
  constructor(cause?: unknown) {
    super('The backup on Drive could not be decrypted with the current data key');
    this.name = 'RemoteDecryptionError';
    this.cause = cause;
  }
}

/**
 * Raised when the data file holds bytes this version cannot read at all — a
 * pre-vault backup, or content nothing here wrote.
 *
 * Pre-vault backups were sealed with a key the *server* held, and the server holds
 * none any more, so there is no migration left to offer. That is precisely why
 * overwriting them is unacceptable: the file on Drive is the last copy of that data
 * in existence. Refusing costs the user a manual rename in Drive; the alternative
 * costs them everything they recorded before the vault existed.
 */
export class UnreadableBackupError extends Error {
  constructor() {
    super('Drive holds a backup this version cannot read; it will not be overwritten');
    this.name = 'UnreadableBackupError';
  }
}

function isCurrentFormat(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<EncryptedPayload>;

  return (
    typeof payload.formatVersion === 'number' &&
    typeof payload.iv === 'string' &&
    typeof payload.ciphertext === 'string'
  );
}

/**
 * Keeps the local database and the encrypted backup on Drive in step.
 *
 * Every byte leaving this class is encrypted under the vault's data key, which the
 * server never sees. Both sides are injected, so the decision logic is exercised
 * without a browser or a Drive account.
 */
export class VaultDriveSync {
  constructor(
    private readonly drive: DriveFileGateway,
    private readonly local: LocalSnapshotStore,
    private readonly requireDek: () => CryptoKey,
    private readonly dataFileName: string = CONFIG.dataSourceFile
  ) {}

  async exportToDrive(): Promise<void> {
    if (await this.local.isEmpty()) return;

    const snapshot = await this.local.exportSnapshot();
    const payload = await encryptWithDek(this.requireDek(), snapshot);

    await this.drive.writeFile(this.dataFileName, JSON.stringify(payload));
  }

  async importFromDrive(): Promise<void> {
    const snapshot = await this.readRemoteSnapshot();
    if (snapshot === null) return;

    await this.local.importSnapshot(snapshot);
  }

  /**
   * @throws {RemoteDecryptionError} when a current-format backup cannot be opened.
   */
  async syncNewestDB(): Promise<SyncDecision> {
    const snapshot = await this.readRemoteSnapshot();

    const decision = decideSync({
      isLocalEmpty: await this.local.isEmpty(),
      localLastModified: await this.local.lastUpdated(),
      remoteLastModified:
        snapshot === null ? NO_REMOTE_TIMESTAMP : readLastUpdatedFromSnapshot(snapshot),
    });

    // Import is deliberately disabled here. `importSnapshot` writes rows straight
    // into Dexie, which is now a read model projected from the document, so the
    // document would never learn about them and the next projection would erase
    // them. This build is **export-only**; importing returns as the document's own
    // Drive transport, which merges instead of overwriting.
    if (decision === 'export') await this.exportToDrive();

    return decision;
  }

  /**
   * @throws {UnreadableBackupError} when Drive holds bytes that are not a backup
   * this version can open — never `null`, which the caller acts on by overwriting.
   */
  private async readRemoteSnapshot(): Promise<string | null> {
    const raw = await this.drive.readFile(this.dataFileName);
    if (raw === null || raw.trim() === '') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new UnreadableBackupError();
    }

    // Anything without a format version predates the vault. No key we hold opens it
    // and no key the server holds exists any more, so it is preserved, not replaced.
    if (!isCurrentFormat(parsed)) throw new UnreadableBackupError();

    try {
      return await decryptWithDek(this.requireDek(), parsed);
    } catch (error) {
      throw new RemoteDecryptionError(error);
    }
  }
}
