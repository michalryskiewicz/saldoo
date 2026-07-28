export type SyncDecision = 'import' | 'export' | 'none';

/** Sentinel for "the remote copy carries no usable timestamp". */
export const NO_REMOTE_TIMESTAMP = -1;

export type SyncState = {
  isLocalEmpty: boolean;
  localLastModified: number;
  remoteLastModified: number;
};

/**
 * Decides which way data should flow between this device and Drive.
 *
 * Emptiness is checked before timestamps on purpose: a device that has never been
 * used has no meaningful `localLastModified`, so comparing it would export nothing
 * over a good remote copy.
 */
export function decideSync({
  isLocalEmpty,
  localLastModified,
  remoteLastModified,
}: SyncState): SyncDecision {
  const hasRemoteData = remoteLastModified > 0;
  const hasRemoteTimestamp = remoteLastModified !== NO_REMOTE_TIMESTAMP;

  if (isLocalEmpty && hasRemoteData) return 'import';
  if (!isLocalEmpty && !hasRemoteTimestamp) return 'export';
  if (isLocalEmpty && !hasRemoteTimestamp) return 'none';

  if (remoteLastModified > localLastModified) return 'import';
  if (localLastModified > remoteLastModified) return 'export';

  return 'none';
}
