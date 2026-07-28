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

export async function getOrCreateSaldooFolderId(accessToken: string): Promise<string | null> {
  // Szukaj folderu saldoo
  const folderRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${CONFIG.dataSourceDirectory}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const folderData = await folderRes.json();
  const folderId = folderData.files?.[0]?.id;
  if (folderId) return folderId;
  // Utwórz folder jeśli nie istnieje
  const createFolderRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: CONFIG.dataSourceDirectory,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const createFolderData = await createFolderRes.json();
  return createFolderData.id || null;
}

export async function getOrCreateFileIdInSaldooFolder(
  accessToken: string,
  fileName: string
): Promise<string | null> {
  const folderId = await getOrCreateSaldooFolderId(accessToken);
  if (!folderId) return null;
  // Szukaj pliku w folderze
  const fileRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'+and+'${folderId}'+in+parents+and+trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const fileData = await fileRes.json();
  const fileId = fileData.files?.[0]?.id;
  if (fileId) return fileId;
  // Utwórz plik jeśli nie istnieje
  const createFileRes = await driveFetch(
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
  const createFileData = await createFileRes.json();
  return createFileData.id || null;
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

/** @throws {DriveRequestFailedError} — a write that did not land must not look like one that did. */
export async function writeFileToDrive(accessToken: string, fileId: string, value: string) {
  await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: value,
  });
}

export async function deleteFileFromDrive(accessToken: string, fileId: string) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

