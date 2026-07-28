import {
  getOrCreateFileIdInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '@/database/sync/googleDriveUtils.ts';

/**
 * The narrow slice of Drive the sync layer needs, named by file rather than by id
 * so callers never deal with Drive plumbing.
 */
export interface DriveFileGateway {
  /**
   * @returns the file's contents, empty when nothing has been stored yet.
   * @throws {DriveUnreachableError} rather than reporting a failed read as empty.
   */
  readFile(fileName: string): Promise<string>;
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
  const resolveFile = async (fileName: string) => {
    const accessToken = await getAccessToken();
    const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, fileName);
    if (!fileId) throw new DriveUnreachableError();

    return { accessToken, fileId };
  };

  return {
    async readFile(fileName) {
      return reportingUnreachable(async () => {
        const { accessToken, fileId } = await resolveFile(fileName);

        return readFileFromDrive(accessToken, fileId);
      });
    },

    async writeFile(fileName, content) {
      return reportingUnreachable(async () => {
        const { accessToken, fileId } = await resolveFile(fileName);

        await writeFileToDrive(accessToken, fileId, content);
      });
    },
  };
}
