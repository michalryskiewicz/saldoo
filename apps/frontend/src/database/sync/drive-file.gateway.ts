import {
  createFileInSaldooFolder,
  findFilesInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '@/database/sync/googleDriveUtils.ts';
import { selectDriveFile } from '@/database/sync/drive-file-selection.service.ts';

/**
 * The narrow slice of Drive the sync layer needs, named by file rather than by id
 * so callers never deal with Drive plumbing.
 */
export interface DriveFileGateway {
  /**
   * @returns the file's contents, or `null` when Drive authoritatively holds no
   * such file. An empty string means the file exists and is empty — a different
   * fact, and never on its own evidence of a fresh account.
   * @throws {DriveUnreachableError} rather than reporting a failed read as absent.
   */
  readFile(fileName: string): Promise<string | null>;
  writeFile(fileName: string, content: string): Promise<void>;
}

/**
 * Raised when Drive produced no authoritative answer: the device is offline, the
 * access token could not be obtained, Drive replied with an error status, or the
 * file could not be resolved in the Saldoo folder.
 *
 * The distinction this type carries is the point of it. "We could not look" must
 * never be actioned as "there is nothing there" — that second verdict clears the
 * cached data key and offers to build a fresh vault over data the app merely
 * failed to read.
 */
export class DriveUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('Drive could not be reached, so its contents are unknown');
    this.name = 'DriveUnreachableError';
    this.cause = cause;
  }
}

async function reportingUnreachable<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DriveUnreachableError) throw error;

    throw new DriveUnreachableError(error);
  }
}

export function createDriveFileGateway(getAccessToken: () => Promise<string>): DriveFileGateway {
  const resolve = async (accessToken: string, fileName: string) =>
    selectDriveFile(await findFilesInSaldooFolder(accessToken, fileName));

  return {
    async readFile(fileName) {
      return reportingUnreachable(async () => {
        const accessToken = await getAccessToken();
        const file = await resolve(accessToken, fileName);
        if (!file) return null;

        return readFileFromDrive(accessToken, file.id);
      });
    },

    async writeFile(fileName, content) {
      return reportingUnreachable(async () => {
        const accessToken = await getAccessToken();
        const existing = await resolve(accessToken, fileName);
        const fileId = existing?.id ?? (await createFileInSaldooFolder(accessToken, fileName));
        if (!fileId) throw new DriveUnreachableError();

        await writeFileToDrive(accessToken, fileId, content);
      });
    },
  };
}
