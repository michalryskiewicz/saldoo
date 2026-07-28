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

#### Docker

Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)

```bash
docker --version
docker run hello-world
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

### Step 5: Start PostgreSQL database

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

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

### Direct PostgreSQL access

```bash
docker exec -it saldoo_postgres_dev psql -U admin -d saldoo
```

### Migrations

```bash
bun run migrate
```

---

## Troubleshooting

### Database connection issues

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs postgres
docker compose -f docker-compose.dev.yml restart postgres
```

### Port already in use

```bash
lsof -i :5432
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
and Google Drive, and it is a browser client — there is no client secret. Three
things must be set up in Google Cloud:

1. **Publish the OAuth app** (consent screen → *Publish app*). In *Testing*, Google
   expires consent after **7 days** for any app requesting more than
   name/email/profile, which breaks the Drive connection every week.
2. **Authorized JavaScript origins** must include the origin you serve the frontend
   from. Google Identity Services refuses to start otherwise.
3. **Scopes**: `openid`, `email`, `profile`,
   `https://www.googleapis.com/auth/drive.file`. All non-sensitive, so only basic
   verification applies and no security assessment is required.

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
