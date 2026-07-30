const MARKER = 'legacy';

/**
 * The name the user is asked to rename an unreadable backup to.
 *
 * Naming it for them is the difference between an instruction they can follow and
 * one they have to interpret — and a rename they invent might collide with the name
 * the app is about to create.
 */
export function archivedBackupName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return `${fileName}.${MARKER}`;

  return `${fileName.slice(0, lastDot)}.${MARKER}${fileName.slice(lastDot)}`;
}
