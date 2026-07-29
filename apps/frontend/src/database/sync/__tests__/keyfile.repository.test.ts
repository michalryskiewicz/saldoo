import { describe, it, expect, vi } from 'vitest';
import {
  CorruptKeyfileError,
  DriveKeyfileRepository,
  KEYFILE_NAME,
} from '../keyfile.repository.ts';
import { type DriveFileGateway, DriveUnreachableError } from '../drive-file.gateway.ts';
import { createVault } from '@/crypto/vault.service.ts';

function fakeDrive(files: Record<string, string> = {}): DriveFileGateway {
  return {
    readFile: vi.fn(async (name: string) => files[name] ?? null),
    writeFile: vi.fn(async (name: string, content: string) => {
      files[name] = content;
    }),
  };
}

function unreachableDrive(): DriveFileGateway {
  return {
    readFile: vi.fn(async () => {
      throw new DriveUnreachableError();
    }),
    writeFile: vi.fn(async () => {
      throw new DriveUnreachableError();
    }),
  };
}

async function aKeyfile() {
  const { keyfile } = await createVault({
    passphrase: 'test passphrase',
    passphraseIterations: 1_000,
    recoveryCodeIterations: 1_000,
  });
  return keyfile;
}

describe('DriveKeyfileRepository', () => {
  it('reports no vault when the keyfile has never been written', async () => {
    const repository = new DriveKeyfileRepository(fakeDrive());

    await expect(repository.load()).resolves.toEqual({ status: 'absent' });
  });

  it('refuses to treat an empty keyfile as an absent vault', async () => {
    // An empty keyfile is a half-finished write, not a fresh account. Reading it as
    // "absent" clears this device's data key and offers a new vault, whose first
    // export overwrites the backup the real keyfile still opens.
    const repository = new DriveKeyfileRepository(fakeDrive({ [KEYFILE_NAME]: '   ' }));

    await expect(repository.load()).rejects.toBeInstanceOf(CorruptKeyfileError);
  });

  it('reports the keyfile as unreachable rather than absent when Drive cannot be read', async () => {
    // The whole point of the third state: "absent" would clear the cached data key
    // and offer a fresh vault over data this device simply could not look at.
    const repository = new DriveKeyfileRepository(unreachableDrive());

    await expect(repository.load()).resolves.toEqual({ status: 'unreachable' });
  });

  it('round-trips a keyfile through Drive', async () => {
    const keyfile = await aKeyfile();
    const repository = new DriveKeyfileRepository(fakeDrive());

    await repository.save(keyfile);

    await expect(repository.load()).resolves.toEqual({ status: 'present', keyfile });
  });

  it('writes to the agreed file name so other devices find it', async () => {
    const drive = fakeDrive();
    const repository = new DriveKeyfileRepository(drive);

    await repository.save(await aKeyfile());

    expect(drive.writeFile).toHaveBeenCalledWith(KEYFILE_NAME, expect.any(String));
  });

  it('lets a failed publish surface instead of reporting success', async () => {
    const repository = new DriveKeyfileRepository(unreachableDrive());

    await expect(repository.save(await aKeyfile())).rejects.toBeInstanceOf(DriveUnreachableError);
  });

  it('refuses to treat unparseable content as an absent vault', async () => {
    const repository = new DriveKeyfileRepository(fakeDrive({ [KEYFILE_NAME]: 'not-json' }));

    await expect(repository.load()).rejects.toBeInstanceOf(CorruptKeyfileError);
  });

  it('refuses a keyfile whose shape is wrong', async () => {
    const repository = new DriveKeyfileRepository(
      fakeDrive({ [KEYFILE_NAME]: JSON.stringify({ formatVersion: 1 }) })
    );

    await expect(repository.load()).rejects.toBeInstanceOf(CorruptKeyfileError);
  });

  it('refuses a keyfile with no keyslots, which would be unopenable', async () => {
    const repository = new DriveKeyfileRepository(
      fakeDrive({ [KEYFILE_NAME]: JSON.stringify({ formatVersion: 1, keyslots: [] }) })
    );

    await expect(repository.load()).rejects.toBeInstanceOf(CorruptKeyfileError);
  });

  it('refuses a keyslot that is missing its wrapped key', async () => {
    const repository = new DriveKeyfileRepository(
      fakeDrive({
        [KEYFILE_NAME]: JSON.stringify({
          formatVersion: 1,
          keyslots: [{ kind: 'passphrase', kdf: null }],
        }),
      })
    );

    await expect(repository.load()).rejects.toBeInstanceOf(CorruptKeyfileError);
  });

  it('can be pointed at a different file name', async () => {
    const drive = fakeDrive();
    const repository = new DriveKeyfileRepository(drive, 'custom-keys.json');

    await repository.save(await aKeyfile());

    expect(drive.writeFile).toHaveBeenCalledWith('custom-keys.json', expect.any(String));
  });
});
