# Saldoo

Local-first personal finance app. Bun workspace monorepo.

- `apps/frontend` — React 19 + Vite, Dexie (IndexedDB), Redux Toolkit, shadcn/ui, i18next. This is the product.
- `apps/backend` — Express + Prisma. Reference data only.

## Zero user data on the server — non-negotiable

The backend stores **nothing** that belongs to a user: no accounts, no sessions, no profiles, no financial records. Prisma holds one model (`ExchangeRate`) and it is rebuildable cache. Identity is a single Google token; user data lives in IndexedDB plus the user's own Google Drive, encrypted client-side with a key that never leaves the browser.

Any change that puts user data, or the key that opens it, on the server or in a third-party origin contradicts the product's core claim. Raise it before writing code.

## Scripts

Run from the repo root:

```bash
bun run dev          # both apps
bun run test         # all workspaces
bun run typecheck
bun run lint         # lint:check across workspaces
bun run lint:fix
bun run build
bun run migrate      # backend Prisma migrations
```

There is no CI yet — the gates above are local-only until SALDOO-A2 lands.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `michalryskiewicz/saldoo`, driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
