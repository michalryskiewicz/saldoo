/**
 * Names the tests share with the app.
 *
 * Re-declared rather than imported from `src/`: these are part of the on-Drive contract,
 * and a test that read them from the code could not notice the day one silently changed
 * — every existing user's file would be orphaned and the suite would still be green.
 */
export const DOCUMENT_FILE = 'saldoo-document-v1.json';
export const KEYFILE_NAME = 'saldoo-keys.json';
export const LEGACY_BACKUP_FILE = 'saldoo-data.json';

/** Comfortably over the vault's minimum, and the same on every device in a test. */
export const PASSPHRASE = 'correct horse battery staple';
