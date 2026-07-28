import {
  type DriveFileGateway,
  DriveUnreachableError,
} from '@/database/sync/drive-file.gateway.ts';
import type { Keyfile, Keyslot } from '@/crypto/vault.service.ts';
import type { KeyfileLookup } from '@/crypto/vault-manager.ts';

export const KEYFILE_NAME = 'saldoo-keys.json';

/**
 * Raised when a keyfile exists but cannot be understood.
 *
 * Deliberately NOT collapsed into "absent": treating a damaged keyfile as a
 * missing one would let the app offer to create a fresh vault, which would strand
 * the user's existing data behind a key nobody holds any more.
 */
export class CorruptKeyfileError extends Error {
  constructor(cause?: unknown) {
    super('The keyfile on Drive exists but could not be parsed');
    this.name = 'CorruptKeyfileError';
    this.cause = cause;
  }
}

function isKeyslot(value: unknown): value is Keyslot {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Partial<Keyslot>;

  return (
    typeof slot.kind === 'string' &&
    typeof slot.wrapped === 'object' &&
    slot.wrapped !== null &&
    typeof slot.wrapped.iv === 'string' &&
    typeof slot.wrapped.ciphertext === 'string'
  );
}

function isKeyfile(value: unknown): value is Keyfile {
  if (typeof value !== 'object' || value === null) return false;
  const keyfile = value as Partial<Keyfile>;

  return (
    typeof keyfile.formatVersion === 'number' &&
    Array.isArray(keyfile.keyslots) &&
    keyfile.keyslots.length > 0 &&
    keyfile.keyslots.every(isKeyslot)
  );
}

export class DriveKeyfileRepository {
  constructor(
    private readonly drive: DriveFileGateway,
    private readonly fileName: string = KEYFILE_NAME
  ) {}

  /** @throws {CorruptKeyfileError} when a keyfile is present but unusable. */
  async load(): Promise<KeyfileLookup> {
    let raw: string;
    try {
      raw = await this.drive.readFile(this.fileName);
    } catch (error) {
      if (error instanceof DriveUnreachableError) return { status: 'unreachable' };

      throw error;
    }

    if (raw.trim() === '') return { status: 'absent' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new CorruptKeyfileError(error);
    }

    if (!isKeyfile(parsed)) throw new CorruptKeyfileError();

    return { status: 'present', keyfile: parsed };
  }

  async save(keyfile: Keyfile): Promise<void> {
    await this.drive.writeFile(this.fileName, JSON.stringify(keyfile));
  }
}
