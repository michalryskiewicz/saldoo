import { getDriveAccessToken } from '@/auth/google/drive-token.ts';
import { vaultSession } from '@/crypto/vault-session.ts';
import { createVersionedDriveFile } from '@/database/sync/versioned-drive-file.gateway.ts';
import { documentDb, documentSession } from './document.container.ts';
import { createDocumentDriveSync } from './document-drive-sync.ts';
import { createIndexedDbRemoteVersionStore } from './remote-version.store.ts';

/**
 * The document's own Drive transport: download, merge, upload, in one pass.
 *
 * This is what replaces the whole-database last-writer-wins export. Merging is
 * commutative, so there is no import-or-export decision left, and the version the merge
 * was based on is what stops an upload replacing a write that arrived in between.
 */
export const documentDriveSync = createDocumentDriveSync(
  createVersionedDriveFile(getDriveAccessToken),
  documentSession,
  () => vaultSession.requireDek(),
  createIndexedDbRemoteVersionStore(documentDb)
);
