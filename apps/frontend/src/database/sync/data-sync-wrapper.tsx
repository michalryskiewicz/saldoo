import { type PropsWithChildren, useRef, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CONFIG } from '@/global-config.ts';
import { googleDriveSync } from '@/database/sync/google-drive-sync.ts';
import { useGetProfileQuery } from '@/store/profile-slice.api.ts';
import { PageLoader } from '@/components/loaders/page-loader.tsx';

export const DataSyncWrapper = ({ children }: PropsWithChildren) => {
  const { data, isLoading } = useGetProfileQuery();
  const [loading, setLoading] = useState<boolean>(true);
  // track whether we already performed the initial sync to avoid duplicate folder/file creation
  const initialSyncedRef = useRef(false);

  // Always keep encryption key in sync with profile on each render
  if (data?.encryptionKey) {
    googleDriveSync.setEncryptionKey(data.encryptionKey);
  } else {
    googleDriveSync.clearEncryptionKey();
  }

  // Start the (potentially-creating) sync only once, after profile finished loading
  if (!initialSyncedRef.current && !isLoading) {
    initialSyncedRef.current = true;
    (async () => {
      await googleDriveSync.syncNewestDB();
      setLoading(false);
    })();
  }

  if (loading || isLoading) {
    return <PageLoader title="metrics.syncing_with_drive" />;
  }

  return <GoogleOAuthProvider clientId={CONFIG.googleClientId}>{children}</GoogleOAuthProvider>;
};
