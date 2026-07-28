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
  readFile(fileName: string): Promise<string | null>;
  writeFile(fileName: string, content: string): Promise<void>;
}

export class DriveFileUnavailableError extends Error {
  constructor(fileName: string) {
    super(`Could not resolve "${fileName}" in the Saldoo folder on Drive`);
    this.name = 'DriveFileUnavailableError';
  }
}

export function createDriveFileGateway(
  getAccessToken: () => Promise<string>
): DriveFileGateway {
  return {
    async readFile(fileName) {
      const accessToken = await getAccessToken();
      const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, fileName);
      if (!fileId) return null;

      return readFileFromDrive(accessToken, fileId);
    },

    async writeFile(fileName, content) {
      const accessToken = await getAccessToken();
      const fileId = await getOrCreateFileIdInSaldooFolder(accessToken, fileName);
      if (!fileId) throw new DriveFileUnavailableError(fileName);

      await writeFileToDrive(accessToken, fileId, content);
    },
  };
}
