import { getDriveAccessToken } from '@/auth/google/drive-token.ts';
import { vaultSession } from '@/crypto/vault-session.ts';
import { VaultManager } from '@/crypto/vault-manager.ts';
import { createIndexedDbDekStore } from '@/crypto/dek.store.ts';
import { createDriveFileGateway } from '@/database/sync/drive-file.gateway.ts';
import { DriveKeyfileRepository } from '@/database/sync/keyfile.repository.ts';
import { createDexieSnapshotStore } from '@/database/sync/local-snapshot.store.ts';
import { VaultDriveSync } from '@/database/sync/vault-drive-sync.ts';

const driveFiles = createDriveFileGateway(getDriveAccessToken);

export const vaultManager = new VaultManager(
  new DriveKeyfileRepository(driveFiles),
  createIndexedDbDekStore(),
  vaultSession
);

export const vaultDriveSync = new VaultDriveSync(driveFiles, createDexieSnapshotStore(), () =>
  vaultSession.requireDek()
);
