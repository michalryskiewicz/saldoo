import {
  createFileInSaldooFolder,
  findFilesInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '@/database/sync/googleDriveUtils.ts';
import { selectDriveFile } from '@/database/sync/drive-file-selection.service.ts';
import { DriveUnreachableError } from '@/database/sync/drive-file.gateway.ts';

/**
 * Drive, with the file's version carried in and out.
 *
 * The sibling {@link DriveFileGateway} answers "what is in this file"; this answers "what
 * is in this file *if it has changed*, and let me write only if it still has not". That is
 * the difference between a sync that merges safely and one that can still drop another
 * device's work between our read and our write.
 */

export type RemoteRead =
  /** Drive is sure the folder holds no such file. */
  | { status: 'absent' }
  /** The version the caller already knew still stands, so nothing was downloaded. */
  | { status: 'unchanged'; version: string }
  | { status: 'content'; content: string; version: string };

/**
 * Raised when the remote is not at the version the caller merged against.
 *
 * Deliberately **not** a {@link DriveUnreachableError}: that one is read as "offline" and
 * deliberately left alone, so a losing precondition wearing it would be shrugged off
 * instead of retried.
 */
export class RemoteMovedOnError extends Error {
  constructor(
    readonly expected: string | null,
    readonly found: string | null
  ) {
    super(`The remote moved on: expected version ${expected ?? 'none'}, found ${found ?? 'none'}`);
    this.name = 'RemoteMovedOnError';
  }
}

export interface VersionedDriveFile {
  /**
   * @param knownVersion the version this device last saw, or `null` for "no idea" — which
   * always means download, never "assume unchanged".
   * @throws {DriveUnreachableError} rather than reporting a failed read as absent.
   */
  read(fileName: string, knownVersion: string | null): Promise<RemoteRead>;

  /**
   * @param expectedVersion the version the uploaded content was merged against, or `null`
   * to claim the file does not exist yet.
   * @returns the file's version after the write.
   * @throws {RemoteMovedOnError} when the remote is no longer at `expectedVersion`.
   * @throws {DriveUnreachableError} for anything else.
   */
  write(fileName: string, content: string, expectedVersion: string | null): Promise<string>;
}

async function reportingUnreachable<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DriveUnreachableError) throw error;
    // A precondition that no longer holds is an answer, not a failure to get one.
    if (error instanceof RemoteMovedOnError) throw error;

    throw new DriveUnreachableError(error);
  }
}

export function createVersionedDriveFile(
  getAccessToken: () => Promise<string>
): VersionedDriveFile {
  const resolve = async (accessToken: string, fileName: string) =>
    selectDriveFile(await findFilesInSaldooFolder(accessToken, fileName));

  return {
    async read(fileName, knownVersion) {
      return reportingUnreachable(async () => {
        const accessToken = await getAccessToken();
        const file = await resolve(accessToken, fileName);
        if (!file) return { status: 'absent' };

        // The listing already carried the version, so this comparison costs nothing and
        // saves the whole download.
        if (knownVersion !== null && file.version === knownVersion) {
          return { status: 'unchanged', version: file.version };
        }

        return {
          status: 'content',
          content: await readFileFromDrive(accessToken, file.id),
          version: file.version,
        };
      });
    },

    async write(fileName, content, expectedVersion) {
      return reportingUnreachable(async () => {
        const accessToken = await getAccessToken();
        const existing = await resolve(accessToken, fileName);

        if (expectedVersion === null) {
          // The caller merged against nothing because it believed there was nothing. A file
          // being here means another device created one, and writing would replace contents
          // this device has never read.
          if (existing) throw new RemoteMovedOnError(null, existing.version);

          const created = await createFileInSaldooFolder(accessToken, fileName);
          if (!created) throw new DriveUnreachableError();

          return writeFileToDrive(accessToken, created, content);
        }

        // Gone, or replaced by a different file of the same name. Either way the version the
        // content was merged against is not what is there.
        if (!existing) throw new RemoteMovedOnError(expectedVersion, null);
        if (existing.version !== expectedVersion) {
          throw new RemoteMovedOnError(expectedVersion, existing.version);
        }

        // RESIDUAL RACE, and it is not closable here. Drive documents no write precondition
        // on `files.update` — no `If-Match`, no `ifVersionMatches` — so this check is a read
        // followed by an unguarded write, and another device can land its own write in
        // between. What closes that window is the caller re-reading the version *after* the
        // write and re-merging when it is not the one this write produced: see
        // `document-drive-sync.ts`. Should the spike on Drive's preconditions ever come back
        // positive, the header goes here and this comment goes away.
        return writeFileToDrive(accessToken, existing.id, content);
      });
    },
  };
}
