import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveUnreachableError } from '../drive-file.gateway.ts';
import {
  createVersionedDriveFile,
  RemoteMovedOnError,
} from '../versioned-drive-file.gateway.ts';
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

const FILE_NAME = 'saldoo-document-v1.json';

const aToken = async () => 'token';

const aFile = (version: string, size = 1763) => ({
  id: 'file-id',
  size,
  modifiedTime: '2026-07-30T13:22:00.000Z',
  version,
});

beforeEach(() => {
  // Several tests here assert a spy was *not* called, which reads calls from the previous
  // test unless the counts are cleared.
  vi.clearAllMocks();

  vi.mocked(findFilesInSaldooFolder).mockResolvedValue([aFile('7')]);
  vi.mocked(createFileInSaldooFolder).mockResolvedValue('created-id');
  vi.mocked(readFileFromDrive).mockResolvedValue('{"ciphertext":"..."}');
  vi.mocked(writeFileToDrive).mockResolvedValue('8');
});

describe('reading against a known version', () => {
  it('reports a remote that has not moved without downloading it', async () => {
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.read(FILE_NAME, '7')).resolves.toEqual({ status: 'unchanged', version: '7' });

    // The whole point of carrying the version: the listing already answered the question,
    // so paying for the contents would be paying to learn nothing. A token kept only in
    // memory would void this on every reload, which is why it is stored.
    expect(readFileFromDrive).not.toHaveBeenCalled();
  });

  it('downloads when the remote has moved on', async () => {
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.read(FILE_NAME, '6')).resolves.toEqual({
      status: 'content',
      content: '{"ciphertext":"..."}',
      version: '7',
    });
  });

  it('downloads when nothing is known yet', async () => {
    const drive = createVersionedDriveFile(aToken);

    // A missing token means "download". Treating it as unchanged would skip the one read
    // that a fresh device most needs.
    await expect(drive.read(FILE_NAME, null)).resolves.toMatchObject({ status: 'content' });
  });

  it('reports a file Drive does not hold as absent, not as empty content', async () => {
    vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.read(FILE_NAME, '7')).resolves.toEqual({ status: 'absent' });
  });

  it('reports a failed read as unreachable rather than as absent', async () => {
    vi.mocked(findFilesInSaldooFolder).mockRejectedValue(new DriveRequestFailedError(500));
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.read(FILE_NAME, null)).rejects.toBeInstanceOf(DriveUnreachableError);
  });
});

describe('writing behind a version precondition', () => {
  it('writes when the remote still holds the version the caller merged against', async () => {
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.write(FILE_NAME, 'payload', '7')).resolves.toBe('8');
    expect(writeFileToDrive).toHaveBeenCalledWith('token', 'file-id', 'payload');
  });

  it('refuses to write over a remote that moved on, and uploads nothing', async () => {
    vi.mocked(findFilesInSaldooFolder).mockResolvedValue([aFile('9')]);
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.write(FILE_NAME, 'payload', '7')).rejects.toBeInstanceOf(RemoteMovedOnError);

    // The point of the whole slice: a document that has not absorbed the newer remote
    // never reaches Drive.
    expect(writeFileToDrive).not.toHaveBeenCalled();
  });

  it('refuses to write when the caller believed the file did not exist but it does', async () => {
    const drive = createVersionedDriveFile(aToken);

    // Another device created it in the meantime. Uploading here would replace a file whose
    // contents this device has never seen.
    await expect(drive.write(FILE_NAME, 'payload', null)).rejects.toBeInstanceOf(
      RemoteMovedOnError
    );
    expect(writeFileToDrive).not.toHaveBeenCalled();
  });

  it('creates the file on a genuine first write', async () => {
    vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.write(FILE_NAME, 'payload', null)).resolves.toBe('8');
    expect(createFileInSaldooFolder).toHaveBeenCalledWith('token', FILE_NAME);
    expect(writeFileToDrive).toHaveBeenCalledWith('token', 'created-id', 'payload');
  });

  it('reports the file vanishing under an expected version as the remote moving on', async () => {
    vi.mocked(findFilesInSaldooFolder).mockResolvedValue([]);
    const drive = createVersionedDriveFile(aToken);

    await expect(drive.write(FILE_NAME, 'payload', '7')).rejects.toBeInstanceOf(RemoteMovedOnError);
    expect(createFileInSaldooFolder).not.toHaveBeenCalled();
  });

  it('does not disguise a moved-on remote as an unreachable Drive', async () => {
    vi.mocked(findFilesInSaldooFolder).mockResolvedValue([aFile('9')]);
    const drive = createVersionedDriveFile(aToken);

    // `DriveUnreachableError` is read as "offline" and left alone. A losing precondition
    // has to stay tellable from it or the retry never happens.
    await expect(drive.write(FILE_NAME, 'payload', '7')).rejects.not.toBeInstanceOf(
      DriveUnreachableError
    );
  });
});
