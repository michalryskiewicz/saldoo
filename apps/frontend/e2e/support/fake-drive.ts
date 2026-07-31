/**
 * One Drive folder, held in the Node process running the tests.
 *
 * It lives outside the browser on purpose: both browser contexts route their Drive
 * calls into this same object, and that shared folder is the only thing that makes a
 * two-context test a test of two devices rather than two independent single-device
 * runs.
 *
 * The surface below is exactly what `googleDriveUtils.ts` calls and nothing more —
 * mirroring more of Drive would be inventing behaviour no test can check.
 */

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type FakeDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  content: string;
  modifiedTime: string;
  /** Drive's monotonic counter, which the sync uses as a write precondition. */
  version: string;
};

export type DriveListEntry = {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
  version: string;
};

/**
 * Parsed form of the one query language Drive exposes. Only the three clauses the app
 * actually sends are understood; an unrecognised clause is a test-harness bug and says
 * so rather than quietly matching everything.
 */
type ParsedQuery = {
  name?: string;
  mimeType?: string;
  parent?: string;
};

const NAME_CLAUSE = /^name\s*=\s*'(.*)'$/;
const MIME_CLAUSE = /^mimeType\s*=\s*'(.*)'$/;
const PARENT_CLAUSE = /^'(.*)'\s+in\s+parents$/;

function unescapeLiteral(value: string): string {
  return value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

export function parseDriveQuery(query: string): ParsedQuery {
  const parsed: ParsedQuery = {};

  for (const clause of query.split(' and ').map((part) => part.trim())) {
    if (clause === 'trashed=false') continue;

    const name = NAME_CLAUSE.exec(clause);
    if (name) {
      parsed.name = unescapeLiteral(name[1]);
      continue;
    }

    const mimeType = MIME_CLAUSE.exec(clause);
    if (mimeType) {
      parsed.mimeType = unescapeLiteral(mimeType[1]);
      continue;
    }

    const parent = PARENT_CLAUSE.exec(clause);
    if (parent) {
      parsed.parent = unescapeLiteral(parent[1]);
      continue;
    }

    throw new Error(`Fake Drive does not understand the query clause: ${clause}`);
  }

  return parsed;
}

export interface FakeDrive {
  list(query: string): DriveListEntry[];
  create(metadata: { name: string; mimeType?: string; parents?: string[] }): FakeDriveFile;
  read(id: string): FakeDriveFile | undefined;
  /** @returns the file's version after the write, as Drive reports it. */
  write(id: string, content: string): string;
  remove(id: string): boolean;

  /** Test-facing: the contents of a file by name, or `null` when it does not exist. */
  contents(name: string): string | null;
  /** Test-facing: seed a file as if a previous device had written it. */
  seed(name: string, content: string): void;
  /** Test-facing: every write that reached this folder, oldest first. */
  writeLog(): readonly { name: string; at: number }[];
}

export function createFakeDrive(): FakeDrive {
  const files = new Map<string, FakeDriveFile>();
  const writes: { name: string; at: number }[] = [];
  let counter = 0;
  let clock = 0;

  // A monotonic stand-in for Drive's timestamps: `drive-file-selection.service.ts`
  // picks between same-named candidates by `modifiedTime`, and a real clock at
  // millisecond resolution would let two writes in one test tie.
  const nextModifiedTime = () => new Date(Date.UTC(2026, 0, 1) + clock++ * 1000).toISOString();

  // One counter for the whole folder, as Drive's is per file but only ever compared for
  // equality. Every write moves it, which is what makes a stale precondition detectable.
  let revision = 0;
  const nextVersion = () => String(++revision);

  const byName = (name: string) => [...files.values()].find((file) => file.name === name);

  const create = ({
    name,
    mimeType,
    parents,
  }: {
    name: string;
    mimeType?: string;
    parents?: string[];
  }): FakeDriveFile => {
    const file: FakeDriveFile = {
      id: `fake-${++counter}`,
      name,
      mimeType: mimeType ?? 'application/json',
      parents: parents ?? [],
      content: '',
      modifiedTime: nextModifiedTime(),
      version: nextVersion(),
    };
    files.set(file.id, file);

    return file;
  };

  return {
    create,

    list(query) {
      const parsed = parseDriveQuery(query);

      return [...files.values()]
        .filter((file) => (parsed.name === undefined ? true : file.name === parsed.name))
        .filter((file) => (parsed.mimeType === undefined ? true : file.mimeType === parsed.mimeType))
        .filter((file) => (parsed.parent === undefined ? true : file.parents.includes(parsed.parent)))
        .map((file) => ({
          id: file.id,
          name: file.name,
          size: String(new TextEncoder().encode(file.content).length),
          modifiedTime: file.modifiedTime,
          version: file.version,
        }));
    },

    read(id) {
      return files.get(id);
    },

    write(id, content) {
      const file = files.get(id);
      if (!file) throw new Error(`Fake Drive has no file ${id}`);

      file.content = content;
      file.modifiedTime = nextModifiedTime();
      file.version = nextVersion();
      writes.push({ name: file.name, at: writes.length });

      return file.version;
    },

    remove(id) {
      return files.delete(id);
    },

    contents(name) {
      return byName(name)?.content ?? null;
    },

    seed(name, content) {
      const existing = byName(name);
      if (existing) {
        existing.content = content;
        existing.modifiedTime = nextModifiedTime();
        existing.version = nextVersion();
        return;
      }

      // Seeded files land in the Saldoo folder, creating it when absent, because that
      // is the only place the app ever looks.
      const folder =
        [...files.values()].find((file) => file.mimeType === FOLDER_MIME) ??
        create({ name: 'saldoo', mimeType: FOLDER_MIME });

      create({ name, parents: [folder.id] }).content = content;
    },

    writeLog() {
      return writes;
    },
  };
}
