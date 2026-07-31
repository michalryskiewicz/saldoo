import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDriveFileGateway, DriveUnreachableError } from '../drive-file.gateway.ts';
import {
  createFileInSaldooFolder,
  DriveRequestFailedError,
  findFilesInSaldooFolder,
  readFileFromDrive,
  writeFileToDrive,
} from '../googleDriveUtils.ts';

vi.mock('../googleDriveUtils.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../googleDriveUtils.ts')>();

  return {
    ...actual,
    findFilesInSaldooFolder: vi.fn(),
    createFileInSaldooFolder: vi.fn(),
    readFileFromDrive: vi.fn(),
    writeFileToDrive: vi.fn(),
  };
});

const FILE_NAME = 'saldoo-keys.json';

const aToken = async () => 'token';

const aFile = (
  id: string,
  overrides: { size?: number; modifiedTime?: string; version?: string } = {}
) => ({
  id,
  size: overrides.size ?? 481,
  modifiedTime: overrides.modifiedTime ?? '2026-07-28T13:22:00.000Z',
  version: overrides.version ?? '1',
});

beforeEach(() => {
  vi.mocked(findFilesInSaldooFolder).mockResolvedValue([aFile('file-id')]);
  vi.mocked(createFileInSaldooFolder).mockResolvedValue('created-id');
  vi.mocked(readFileFromDrive).mockResolvedValue('{}');
  vi.mocked(writeFileToDrive).mockResolvedValue('2');
});

describe('createDriveFileGateway', () => {
  describe('reads that produced an authoritative answer', () => {
    it('returns the file content', async () => {
      vi.mocked(readFileFromDrive).mockResolvedValue('{"formatVersion":1}');

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).resolves.toBe('{"formatVersion":1}');
    });

    it('reports a file Drive does not hold as null, not as empty content', async () => {
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).resolves.toBeNull();
    });

    it('never creates a file while reading', async () => {
      // Creating on read is what leaves a 0-byte keyfile behind when the write it
      // was meant to precede never lands — and an empty keyfile read as "no vault"
      // clears the data key and overwrites the backup.
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);

      const gateway = createDriveFileGateway(aToken);
      await gateway.readFile(FILE_NAME);

      expect(createFileInSaldooFolder).not.toHaveBeenCalled();
    });

    it('reports an existing but empty file as empty content, not as absent', async () => {
      vi.mocked(readFileFromDrive).mockResolvedValue('');

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).resolves.toBe('');
    });

    it('reads the duplicate that carries content, not whichever Drive lists first', async () => {
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([
        aFile('abandoned', { size: 0, modifiedTime: '2026-07-28T13:21:00.000Z' }),
        aFile('real', { size: 481, modifiedTime: '2026-07-28T13:22:00.000Z' }),
      ]);

      const gateway = createDriveFileGateway(aToken);
      await gateway.readFile(FILE_NAME);

      expect(readFileFromDrive).toHaveBeenCalledWith('token', 'real');
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

    it('rejects when the folder lookup itself fails', async () => {
      vi.mocked(findFilesInSaldooFolder).mockRejectedValue(new DriveRequestFailedError(500));

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.readFile(FILE_NAME)).rejects.toBeInstanceOf(DriveUnreachableError);
    });
  });

  describe('writes', () => {
    it('writes to the same duplicate it reads from', async () => {
      // Reading the real file and writing to the abandoned one would leave both
      // wrong: a stale backup nobody updates, and a keyfile nobody can open.
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([
        aFile('abandoned', { size: 0, modifiedTime: '2026-07-28T13:21:00.000Z' }),
        aFile('real', { size: 481, modifiedTime: '2026-07-28T13:22:00.000Z' }),
      ]);

      const gateway = createDriveFileGateway(aToken);
      await gateway.writeFile(FILE_NAME, '{}');

      expect(writeFileToDrive).toHaveBeenCalledWith('token', 'real', '{}');
    });

    it('creates the file when the folder holds none', async () => {
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);

      const gateway = createDriveFileGateway(aToken);
      await gateway.writeFile(FILE_NAME, '{}');

      expect(writeFileToDrive).toHaveBeenCalledWith('token', 'created-id', '{}');
    });

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

    it('rejects when the file cannot be created', async () => {
      vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);
      vi.mocked(createFileInSaldooFolder).mockResolvedValue(null);

      const gateway = createDriveFileGateway(aToken);

      await expect(gateway.writeFile(FILE_NAME, '{}')).rejects.toBeInstanceOf(
        DriveUnreachableError
      );
    });
  });
});
