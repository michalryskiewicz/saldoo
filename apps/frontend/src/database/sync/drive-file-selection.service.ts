import type { DriveFileSummary } from '@/database/sync/googleDriveUtils.ts';

/**
 * Picks the one file a name refers to when Drive offers more than one.
 *
 * Drive permits duplicate names within a folder and returns them in no promised
 * order, so `files[0]` is a coin toss — and one of the faces silently destroys the
 * user's backup. The rule is therefore: prefer content over emptiness, then prefer
 * the most recent.
 *
 * An empty file is never dropped altogether. "Every candidate is empty" and "the
 * folder holds no such file" are different facts, and only the second one may ever
 * be acted on as "no vault was created here".
 *
 * @returns the chosen candidate, or `null` only when there were none.
 */
export function selectDriveFile(candidates: DriveFileSummary[]): DriveFileSummary | null {
  const withContent = candidates.filter((candidate) => candidate.size > 0);
  const considered = withContent.length > 0 ? withContent : candidates;

  return considered.reduce<DriveFileSummary | null>(
    (newest, candidate) =>
      newest === null || candidate.modifiedTime > newest.modifiedTime ? candidate : newest,
    null
  );
}
