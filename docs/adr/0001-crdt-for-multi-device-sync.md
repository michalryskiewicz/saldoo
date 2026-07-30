# ADR-0001: Use a CRDT library for multi-device merge, keep our own Drive transport

- **Status:** Accepted
- **Date:** 2026-07-30
- **Context:** spike for [#37 SALDOO-A6](https://github.com/michalryskiewicz/saldoo/issues/37)
- **Supersedes in part:** the hand-rolled merge engine described in #37 (HLC stamps, tombstone tables, per-record merge algorithm)

## Context

Drive sync is whole-database last-writer-wins: `decideSync()` returns one `import | export | none`
for the entire database, so a second device overwrites the first device's work wholesale, and hard
deletes without tombstones resurrect on the next import. #37 proposed fixing this by writing our own
merge engine — hybrid logical clocks, tombstone tables with a retention window, a per-record merge
function, and an oplog fed by a Dexie `DBCore` middleware.

Writing a conflict-resolution engine by hand is the highest-risk part of that plan, and the problem
is thoroughly solved by existing libraries. This ADR asks whether one of them can do the work.

## Constraints that decide this

| | Constraint | Source |
|---|---|---|
| R1 | The backend stores **no user data**. No relay, no metadata endpoint, no hosted sync service. The user's own Google Drive is the only remote. | Product's core claim |
| R2 | The existing vault model must not regress: passphrase → PBKDF2 600k → DEK, non-extractable, memory-only, 30-minute idle lock, keyslots on Drive. | Shipped in #7 |
| R3 | Bundle stays small. The whole frontend is ~588 KB gz; a PWA opened on a phone cannot absorb megabytes. | Measured 2026-07-28 |
| R4 | Existing users' data migrates without loss. | |
| R5 | Merge must be per-record, propagate deletions, and converge to the same result on every device regardless of sync order. | #37 |

## Options considered

### Rejected: batteries-included sync frameworks

All of these fail **R1** — they need a server that is the source of truth. This is the same
structural reason [PGlite sync was rejected](https://pglite.dev/docs/sync) on 2026-07-28.

- **TanStack DB** — markets itself as a "backend-agnostic sync engine", but it turns *synced API
  data* into typed collections, and real-time only arrives when paired with a sync engine such as
  ElectricSQL. It assumes a backend holds the truth.
- **ElectricSQL / PGlite sync, Dexie Cloud, Replicache/Zero, PowerSync, Triplit, InstantDB,
  Convex** — all hosted-backend-shaped.
- **Evolu** — genuinely close: local-first, CRDT, end-to-end encrypted, MIT, self-hostable relay.
  Still a relay server (R1), brings SQLite WASM (R3), and has its own mnemonic-based key model that
  collides with the vault we just shipped (R2).
- **Fireproof** — closest on paper: "cloudless", encrypted immutable content-addressed files, any
  storage provider, no WASM. But a **metadata endpoint is required** to sync (R1), and its keys live
  in `localStorage` "synchronized alongside the CRDT file pointers", which is strictly weaker than
  our vault (R2). Also pre-1.0 (0.24.x) and AFL-2.0.
- **`dexie-syncable` / `dexie-observable`** — would have satisfied R1, since `ISyncProtocol` lets the
  "remote" be anything. But the last publish was **~3 years ago** (4.0.1-beta.13) and the addons are
  being phased out in favour of Dexie Cloud. Dead end — though its change-tracking model is worth
  reading as prior art.

The pattern: everything that ships a complete sync solution ships a server with it, because the
server is where the merge happens. Our unusual requirement is precisely that there is no server.

### Chosen: a CRDT library for merge, our own transport

CRDT libraries are **transport-agnostic and need no server at all**. Merging two divergent replicas
is a local function call; the state serialises to a blob. An encrypted blob on the user's own Drive
is therefore a sufficient transport.

Candidates, measured 2026-07-30:

| | Bundle | Notes |
|---|---|---|
| **Yjs** 13.6.31 | **27 KB gz** (90 KB min) | Pure JS. Smaller than Dexie itself (30 KB gz). |
| Automerge 3.3.2 | ~3.3 MB raw WASM | Full git-like history. WASM payload alone is ~5× the whole app. |
| Loro 1.13.8 | ~3.1 MB raw WASM | Fastest, smallest encoded docs, youngest ecosystem. |

**Yjs is the choice**, on R3. Automerge's and Loro's WASM payloads are the same disqualifier that
killed PGlite: ~3 MB against a 588 KB app, for a PWA on a phone. Yjs costs less than the database
library already in the bundle.

The sync loop becomes, in full:

```
download saldoo-data-v2.json → decrypt → Y.applyUpdate(localDoc, remote)
                             → Y.encodeStateAsUpdate(localDoc) → encrypt → upload
```

`Y.applyUpdate` **merges** — it does not overwrite — and works with no network provider. That single
call replaces the entire hand-rolled engine.

## What this deletes from #37

- **HLC version stamps.** Yjs has its own internal clock.
- **Tombstone tables, the 90-day retention window, and the stale-device horizon reset.** Deletion is
  `ymap.delete(id)`; propagation is internal.
- **The per-record merge algorithm and its conflict rule.**
- **The `DBCore` oplog middleware**, including range-delete key resolution and the
  replication-write bypass — with the `Y.Doc` as the source of truth, the document *is* the oplog.
- **Field-level merge for the settings singleton.** A record modelled as a `Y.Map` of fields gives
  per-field concurrency for free, which is *better* than the record-level LWW #37 settled for: two
  devices editing different fields of the same expense both keep their edit.

## What survives regardless

- **The Drive transport**: download, decrypt, apply, encode, encrypt, upload, plus the one-time
  migration from `saldoo-data.json` and the rule that an empty local database must not overwrite a
  non-empty backup.
- **Optimistic concurrency on the write.** Yjs guarantees the *merge* is safe; it does not stop our
  `PATCH` from clobbering a write another device made between our read and our write. The
  `If-Match` spike is still needed.
- **Outbox and offline UX.** Every mutator currently awaits `exportToDrive()` inside the same
  `try/catch` as the local write, so an offline user is told the expense could not be added while the
  record sits safely in IndexedDB. Unrelated to merge.
- **Dedupe on the unique indexes.** A `Y.Map` has no unique constraint, so two devices each adding a
  tag named "food" still produce two entries. `transactions.&hash` and `tags.&name` need application
  logic in any design.
- **Migration of existing data** into the document.

## Consequences

- **Dexie's role changes.** The `Y.Doc` becomes the source of truth and Dexie becomes a derived read
  model (or is dropped). This is cheap here: measured 2026-07-30, `useLiveQuery` appears in **9
  files**, anything touching `db.` in **48 of 217**, and indexed querying is almost absent —
  3 × `.where(`, 2 × `.anyOf(`, 23 × `.filter(`, so the codebase already reads whole tables and
  filters in JS.
- **The document only grows.** Yjs cannot fully garbage-collect tombstones while preserving struct
  order; with `gc` enabled it does drop deleted *content* and merges adjacent structs. For personal
  finance records — thousands of rows, not 260k text operations — this is not a near-term concern,
  but it is not zero, and it argues against ever turning `gc` off.
- **`dexie-export-import` stops being the sync payload**, so the encrypted file format changes. This
  is why the new payload goes to a new file name rather than reusing `saldoo-data.json`.
- **Undo comes free later.** `Y.UndoManager` covers the "Undo instead of success toasts" work that
  was Phase 2 of the offline-first plan.
- **New dependency risk.** Yjs is the incumbent (~920k weekly downloads, MIT), which is the low end
  of this risk, but the data model becomes coupled to it.

## Revised slice count for #37

Ten slices become six, and the three riskiest disappear:

1. Spike: does Drive honour a write precondition on the media-upload endpoint. *(unchanged)*
2. `Y.Doc` as source of truth; migrate existing data into it; Dexie as derived read model.
3. Drive transport on `saldoo-data-v2.json`, with one-time migration from the old file.
4. Dedupe on `transactions.&hash` and `tags.&name`.
5. Outbox, retry with backoff, one writer across tabs, offline UX.
6. Optimistic-concurrency write path.

## Revisit if

- The encrypted document grows enough that downloading it on every sync becomes painful — the answer
  then is splitting the payload, which #37 already scopes out until it matters.
- A CRDT framework appears that keeps merge **and** needs no server **and** lets us keep our own key
  model. Fireproof is the nearest miss; a Drive gateway plus our own key handling would be the thing
  to re-evaluate.

## Amendment, 2026-07-30: duty identity is its hash

#37 originally excluded `duties` from sync and recomputed them locally, because
`addDBDutiesForDateRange` minted `id: uuidv4()` beside a *deterministic* `hash` under a
unique index — so two devices regenerating the same window produced two rows racing on
that index.

That worked around the cause instead of removing it. **The `hash` is now the primary
key**, so the same logical duty is the same row on every device and duties sync like any
other table.

It also closes a gap the exclusion created. `resolved`, `ignored` and `transactionId` are
user decisions, not derivable from expenses, so excluding duties meant marking one paid on
the phone never reached the laptop.

Safe because `hashString` is an untruncated SHA-256; a collision is not a practical
concern. This was checked before committing to the approach — with a weak hash it would
mean two different duties sharing a primary key, which is silent data loss.

Costs, accepted knowingly:

- A one-time re-key of existing rows from uuid to hash. The pre-existing unique index on
  `hash` guarantees no two rows share one, so the re-key cannot collide.
- Derived data now lives in the synced document. The alternative — syncing only the user's
  decisions, keyed by hash — needs a second projection shape and a rule for cleaning up
  states whose duty no longer exists. One mechanism beats two.
- A device that generated duties further into the future pushes them to the other device.
