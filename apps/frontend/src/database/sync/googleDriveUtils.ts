import { CONFIG } from '@/global-config.ts';

/**
 * Raised when Drive answers, but not with success.
 *
 * Deliberately not collapsed into an empty result: an expired token answers 401,
 * and a caller that reads that as "the file is not there" will happily overwrite
 * a backup — or offer to build a fresh vault over data it cannot see.
 */
export class DriveRequestFailedError extends Error {
  constructor(readonly status: number) {
    super(`Drive answered with status ${status}`);
    this.name = 'DriveRequestFailedError';
  }
}

/** @throws {DriveRequestFailedError} on any non-2xx answer. */
async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) throw new DriveRequestFailedError(response.status);

  return response;
}

/** What the file listing tells us about one candidate, and all it needs to tell us. */
export type DriveFileSummary = {
  id: string;
  size: number;
  modifiedTime: string;
  /**
   * Drive's own monotonic counter for the file — "every change made to the file on the
   * server, even those not visible to the user".
   *
   * It is read from the *listing*, which is what lets a caller notice the remote has not
   * moved without downloading the contents to find out.
   */
  version: string;
};

/**
 * Drive's query language quotes string literals with `'`, so a name carrying one
 * would end the literal early. Today every name is a build-time constant, which is
 * exactly why this is easy to forget the day one stops being.
 */
function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function listUrl(query: string, fields: string): string {
  return `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

type DriveFileListEntry = {
  id?: string;
  size?: string;
  modifiedTime?: string;
  version?: string;
};

/** @returns the folder id, or `null` when this account has no Saldoo folder yet. */
export async function findSaldooFolderId(accessToken: string): Promise<string | null> {
  const response = await driveFetch(
    listUrl(
      `name='${driveQueryLiteral(CONFIG.dataSourceDirectory)}' and mimeType='${FOLDER_MIME}' and trashed=false`,
      'files(id)'
    ),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await response.json();

  return data.files?.[0]?.id ?? null;
}

export async function getOrCreateSaldooFolderId(accessToken: string): Promise<string | null> {
  const existing = await findSaldooFolderId(accessToken);
  if (existing) return existing;

  const created = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: CONFIG.dataSourceDirectory, mimeType: FOLDER_MIME }),
  });

  return (await created.json()).id || null;
}

/**
 * Lists every file of that name in the Saldoo folder — plural, because Drive is
 * perfectly happy to hold several files sharing one name, and which one comes back
 * first is not something a caller may rely on.
 *
 * Creates nothing: a read must never leave an artefact behind that a later read
 * would mistake for the user's own data.
 *
 * @returns the candidates, empty when the folder or the file does not exist.
 */
export async function findFilesInSaldooFolder(
  accessToken: string,
  fileName: string
): Promise<DriveFileSummary[]> {
  const folderId = await findSaldooFolderId(accessToken);
  if (!folderId) return [];

  const response = await driveFetch(
    listUrl(
      `name='${driveQueryLiteral(fileName)}' and '${driveQueryLiteral(folderId)}' in parents and trashed=false`,
      'files(id,size,modifiedTime,version)'
    ),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await response.json();
  const files: DriveFileListEntry[] = data.files ?? [];

  return files
    .filter((file): file is DriveFileListEntry & { id: string } => !!file.id)
    .map((file) => ({
      id: file.id,
      size: Number(file.size ?? 0),
      modifiedTime: file.modifiedTime ?? '',
      version: file.version ?? '',
    }));
}

/** @returns the new file's id, or `null` when Drive declined to make one. */
export async function createFileInSaldooFolder(
  accessToken: string,
  fileName: string
): Promise<string | null> {
  const folderId = await getOrCreateSaldooFolderId(accessToken);
  if (!folderId) return null;

  const response = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
      }),
    }
  );

  return (await response.json()).id || null;
}

/**
 * @returns the file's contents — an empty string when nothing has been stored yet.
 * @throws {DriveRequestFailedError} rather than reporting a failed read as empty.
 */
export async function readFileFromDrive(accessToken: string, fileId: string): Promise<string> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return await res.text();
}

/**
 * @returns the file's version *after* the write, so a caller can tell its own write apart
 * from somebody else's.
 * @throws {DriveRequestFailedError} — a write that did not land must not look like one
 * that did.
 */
export async function writeFileToDrive(
  accessToken: string,
  fileId: string,
  value: string
): Promise<string> {
  const response = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=version`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: value,
    }
  );

  return (await response.json()).version ?? '';
}

export async function deleteFileFromDrive(accessToken: string, fileId: string) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

