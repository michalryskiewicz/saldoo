# 🚀 Installation Guide

Complete step-by-step guide to run Saldoo locally.

## Table of Contents

- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)
- [Contact](#contact)

---

## Local Development

### Step 1: Install prerequisites

#### Bun Runtime

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

#### Docker (optional)

Only needed to run the production stack via `docker-compose.yml`. Local development
needs nothing but Bun — the database is a SQLite file.

```bash
docker --version
```

### Step 2: Clone repository

```bash
git clone https://github.com/michalryskiewicz/saldoo.git
cd saldoo
```

### Step 3: Install dependencies

```bash
bun install
```

### Step 4: Configure environment

```bash
cp .env.example .env
```

### Step 5: Create the local database

```bash
bun run migrate
```

This creates `apps/backend/prisma/data/saldoo.db`. It holds nothing but a cache of
public NBP exchange rates, so deleting it is always safe.

### Step 6: Run the application

```bash
bun run dev:backend
bun run dev:frontend
```

### Step 7: Access the app

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Prisma Studio: http://localhost:5555

---

## Database Management

### Prisma Studio

```bash
cd apps/backend
bunx prisma studio
```

### Direct SQLite access

```bash
sqlite3 apps/backend/prisma/data/saldoo.db
```

### Migrations

```bash
bun run migrate
```

### Starting over

```bash
rm -rf apps/backend/prisma/data && bun run migrate
```

Safe at any time — the file is a cache, not a record.

---

## Troubleshooting

### Database issues

The database is a single SQLite file and holds only cached NBP rates, so the fix is
almost always to recreate it:

```bash
rm -rf apps/backend/prisma/data && bun run migrate
```

### Port already in use

```bash
lsof -i :3000
lsof -i :5173
```

### Module/dependency issues

```bash
rm -rf node_modules
bun install
```

### Google OAuth issues

```bash
grep VITE_GOOGLE_CLIENT .env
```

Saldoo uses a **single** Google OAuth client (type: Web application) for both login
and Google Drive, and the browser talks to Google directly — no client secret is used
and none is needed. Settings live under **Google Auth Platform** in the console:

1. **Authorized JavaScript origins** (*Clients*) must include the origin you serve the
   frontend from. Google Identity Services refuses to start otherwise. Leave
   *Authorized redirect URIs* empty: this flow uses no redirect.
2. **Scopes** (*Data access*): `openid`, `email`, `profile`,
   `https://www.googleapis.com/auth/drive.file`. All non-sensitive, so publishing needs
   no verification review and no security assessment.
3. **Publishing status** (*Audience*) → *In production*. In *Testing*, Google shows
   every test user an "app is currently being tested" screen before consent.

The client identity is load-bearing beyond configuration: `drive.file` grants access
only to files the app itself created, so **a new client ID cannot see the keyfile the
old one wrote**. Never swap or delete the client this app signs in with.

The 7-day expiry often cited for *Testing* apps does not apply here: it is scoped to
refresh tokens, and this browser flow never receives one.

### "Nie udało się otworzyć danych" on startup

The app could not read its keyfile (`saldoo-keys.json`) from your Drive — usually the
Drive token could not be renewed, so check the three points above. Nothing is lost:
your data stays in the browser's IndexedDB and in the encrypted backup on Drive.

### Lost passphrase

Use the recovery code shown once during setup. **If both are gone, nobody can recover
the data** — no copy of either secret exists on any server. That is the deliberate
trade-off; see `apps/frontend/src/database/sync/README.md`.

---

## Contact

- Website: [https://rysiuo.it](https://rysiuo.it)
- Email: kontakt@rysiuo.it
