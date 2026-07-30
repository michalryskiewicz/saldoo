# Google Drive data sync

## Security model

**The Saldoo server holds no user data and no key.** Everything needed to read the
data lives either on the user's own Google Drive or in their head.

Encryption is envelope encryption, the same shape as LUKS, `age` or Bitwarden:

- **DEK** (Data Encryption Key) — a random 256-bit key encrypting the Dexie export
  (AES-GCM, a fresh IV per write). It never leaves the browser in the clear.
- **Keyslots** — the DEK encrypted separately under each unlock method. They go to
  Drive as `saldoo-keys.json`, right next to the data. Every slot is useless without
  the secret that opens it, and that secret is **not** on Drive.

The slots created when a vault is set up:

| Slot | KDF | Role |
|---|---|---|
| `recovery-code` | PBKDF2-SHA256, 100k | 128 bits of entropy, shown once, root of trust |
| `passphrase` | PBKDF2-SHA256, 600k | the user's own secret, for everyday use |

The keyfile format is versioned and extensible — adding a `passkey-prf` slot
(WebAuthn PRF) is **re-wrapping the DEK, not re-encrypting the data**.

A consequence worth remembering when writing user-facing copy: Google, and anyone
who gets into the user's Google account, holds the ciphertext — but **not** the
passphrase or the recovery code. Losing the passphrase **and** the recovery code
means the data is gone for good.

## Files on Drive

Both live in the `saldoo` folder (scope `drive.file`, so the app only ever sees the
files it created itself):

- `saldoo-data.json` — `EncryptedPayload` (`formatVersion`, `iv`, `ciphertext`)
- `saldoo-keys.json` — `Keyfile` (`formatVersion`, `keyslots[]`)

## Vault lifecycle

`VaultManager` (`@/crypto/vault-manager.ts`) settles the state at app start.
**The keyfile on Drive is the single source of truth** for whether a vault exists —
a cached DEK alone is never enough.

| Keyfile | Cached DEK | State |
|---|---|---|
| missing | — | `needs-setup` (the cache is cleared) |
| present | missing | `locked` |
| present | present | `unlocked` |

The DEK is cached per device in its **own** Dexie database, `saldoo-vault`.
Deliberately not in the app database's `meta` table: `exportDB` serialises every
table it is handed, so a key sitting next to the app's data would be written
straight into the backup on Drive.

`VaultGate` (`@/features/vault/vault-gate.tsx`) sits in front of `DataSyncWrapper`
and lets nothing through until a DEK is available.

## Updating `lastUpdated`

The timestamp in the `meta` table is bumped by every operation that changes data:

```typescript
// expenses.ts, profits.ts, transactions.ts, duty.ts, tags.ts
await db.expenses.add({ ... });
await setLastUpdated();
await vaultDriveSync.exportToDrive();
```

On import the timestamp comes back by itself — `importInto` from
`dexie-export-import` imports **every** table, `meta` included.

## Sync logic

The decision is a pure function: `decideSync()` in `sync-decision.service.ts`
(covered by `__tests__/sync-decision.service.test.ts`).

| Local state | Remote state | Decision |
|---|---|---|
| empty | has data | `import` |
| has data | no timestamp | `export` |
| empty | no timestamp | `none` |
| — | newer than local | `import` |
| newer than remote | — | `export` |
| equal | equal | `none` |

Emptiness is checked **before** timestamps on purpose: a fresh device has no
meaningful `localLastModified`, so comparing them would have it export nothing over
a perfectly good remote copy.

`syncNewestDB()` reads and decrypts the file from Drive **exactly once**, then works
off that result.

## Guards against data loss

Six rules that must not be relaxed — each one has a test:

1. **A damaged keyfile raises `CorruptKeyfileError` and never poses as "no vault".**
   If it did, the app would offer to create a fresh vault and strand the existing
   data behind the old key.
2. **An empty keyfile is a `CorruptKeyfileError` too.** The only evidence that a
   vault was never created is a file the folder does **not** hold — `readFile()`
   returns `null` for that. A file that exists and says nothing is an unfinished
   write.
3. **Reading creates nothing.** `getOrCreateFileIdInSaldooFolder()` used to create
   the file while looking for it; when the write meant to follow never landed, a
   0-byte keyfile stayed on Drive — which is exactly rule 2.
4. **Among duplicate names, the newest non-empty file wins** (`selectDriveFile`).
   Drive allows several files to share a name and promises no ordering, so `files[0]`
   is a coin toss in which one of the faces destroys the backup.
5. **A backup that cannot be read is never overwritten.** A wrong DEK against the
   current format → `RemoteDecryptionError`. A file **without** `formatVersion`
   (pre-vault) or bytes that will not parse → `UnreadableBackupError` and a screen
   telling the user which file to rename. Pre-vault backups were sealed with a key
   the server held and the server holds none any more, so there is no migration to
   offer and the file is left untouched.
6. **`exportToDrive()` refuses to overwrite the backup with an empty database.**

## The Drive token

One Google token for everything — the same OAuth client and the same consent as the
login. `DriveTokenService` (`@/auth/google/drive-token.service.ts`) renews it
silently through Google Identity Services (`prompt: ''`), keeping it in memory and
in `sessionStorage` (not a cookie: it never rides along with a request, and it dies
with the tab).

`GoogleDriveButton` is **only** a fallback for when Google declines the silent
renewal.

## Debugging

`syncNewestDB()` returns the decision it took (`'import' | 'export' | 'none'`), so
tests and the console show the outcome without digging through logs.
