import { CONFIG } from '@/global-config.ts';

export async function getOrCreateSaldooFolderId(accessToken: string): Promise<string | null> {
  // Szukaj folderu saldoo
  const folderRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${CONFIG.dataSourceDirectory}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const folderData = await folderRes.json();
  const folderId = folderData.files?.[0]?.id;
  if (folderId) return folderId;
  // Utwórz folder jeśli nie istnieje
  const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
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
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'+and+'${folderId}'+in+parents+and+trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const fileData = await fileRes.json();
  const fileId = fileData.files?.[0]?.id;
  if (fileId) return fileId;
  // Utwórz plik jeśli nie istnieje
  const createFileRes = await fetch(
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

export async function readFileFromDrive(
  accessToken: string,
  fileId: string
): Promise<string | null> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.text();
}

export async function writeFileToDrive(accessToken: string, fileId: string, value: string) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: value,
  });
}

export async function deleteFileFromDrive(accessToken: string, fileId: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

