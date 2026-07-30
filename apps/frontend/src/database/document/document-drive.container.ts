import { getDriveAccessToken } from '@/auth/google/drive-token.ts';
import { vaultSession } from '@/crypto/vault-session.ts';
import { createDriveFileGateway } from '@/database/sync/drive-file.gateway.ts';
import { documentSession } from './document.container.ts';
import { createDocumentDriveSync } from './document-drive-sync.ts';

/**
 * The document's own Drive transport: download, merge, upload, in one pass.
 *
 * This is what replaces the whole-database last-writer-wins export. Merging is
 * commutative, so there is no import-or-export decision left and no device can
 * overwrite another's work by syncing at the wrong moment.
 */
export const documentDriveSync = createDocumentDriveSync(
  createDriveFileGateway(getDriveAccessToken),
  documentSession,
  () => vaultSession.requireDek()
);
