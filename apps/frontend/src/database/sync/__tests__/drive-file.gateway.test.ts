import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDriveFileGateway, DriveUnreachableError } from '../drive-file.gateway.ts';
import {
  DriveRequestFailedError,
  getOrCreateFileIdInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '../googleDriveUtils.ts';

vi.mock('../googleDriveUtils.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../googleDriveUtils.ts')>();

  return {
    ...actual,
    getOrCreateFileIdInSaldooFolder: vi.fn(),
    readFileFromDrive: vi.fn(),
    writeFileToDrive: vi.fn(),
  };
});

const FILE_NAME = 'saldoo-keys.json';

const aToken = async () => 'token';

beforeEach(() => {
  vi.mocked(getOrCreateFileIdInSaldooFolder).mockResolvedValue('file-id');
  vi.mocked(readFileFromDrive).mockResolvedValue('{}');
  vi.mocked(writeFileToDrive).mockResolvedValue(undefined);
});

describe('createDriveFileGateway', () => {
  describe('reads that produced an authoritative answer', () => {
    it('returns the file content', async () => {
      vi.mocked(readFileFromDrive).mockResolvedValue('{"formatVersion":1}');

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).resolves.toBe('{"formatVersion":1}');
    });

    it('returns the empty body of a freshly created file', async () => {
      vi.mocked(readFileFromDrive).mockResolvedValue('');

      const gateway = createDriveFileGateway(aToken);

      // Empty is the one answer that legitimately means "nothing is stored yet".
      await expect(gateway.readFile(FILE_NAME)).resolves.toBe('');
    });
  });

  describe('reads that produced no authoritative answer', () => {
    it('rejects when the device is offline', async () => {
      vi.mocked(readFileFromDrive).mockRejectedValue(new TypeError('Failed to fetch'));

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).rejects.toBeInstanceOf(DriveUnreachableError);
    });

    it('rejects when the access token cannot be obtained', async () => {
      const gateway = createDriveFileGateway(async () => {
        throw new Error('silent renew failed');
      });

      await expect(gateway.readFile(FILE_NAME)).rejects.toBeInstanceOf(DriveUnreachableError);
    });

    it('rejects when Drive answers with an error status', async () => {
      // A 401 must never reach the vault as "no keyfile": that verdict clears the
      // cached data key and offers to build a fresh vault over existing data.
      vi.mocked(readFileFromDrive).mockRejectedValue(new DriveRequestFailedError(401));

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).rejects.toBeInstanceOf(DriveUnreachableError);
    });

    it('rejects when the folder lookup cannot resolve a file id', async () => {
      vi.mocked(getOrCreateFileIdInSaldooFolder).mockResolvedValue(null);

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).rejects.toBeInstanceOf(DriveUnreachableError);
    });
  });

  describe('writes', () => {
    it('rejects when the device is offline', async () => {
      vi.mocked(writeFileToDrive).mockRejectedValue(new TypeError('Failed to fetch'));

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.writeFile(FILE_NAME, '{}')).rejects.toBeInstanceOf(
        DriveUnreachableError
      );
    });

    it('rejects when Drive answers with an error status', async () => {
      vi.mocked(writeFileToDrive).mockRejectedValue(new DriveRequestFailedError(403));

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.writeFile(FILE_NAME, '{}')).rejects.toBeInstanceOf(
        DriveUnreachableError
      );
    });

    it('rejects when the folder lookup cannot resolve a file id', async () => {
      vi.mocked(getOrCreateFileIdInSaldooFolder).mockResolvedValue(null);

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.writeFile(FILE_NAME, '{}')).rejects.toBeInstanceOf(
        DriveUnreachableError
      );
    });
  });
});
