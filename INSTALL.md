# 🚀 Installation Guide

Complete step-by-step guide to run Rysiu locally.

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
grep GOOGLE_CLIENT .env
```

---

## Contact

- Website: [https://rysiuo.it](https://rysiuo.it)
- Email: ryskiewicz.m@gmail.com
