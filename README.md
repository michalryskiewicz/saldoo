# 🔐 Saldoo

> **Personal Finance Management Application** - Track expenses, plan budgets, and understand your money.

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun-FFD700.svg)](https://bun.sh)
[![Frontend](https://img.shields.io/badge/frontend-React%2019-61DAFB.svg)](https://react.dev)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start-5-minutes)
- [Local Development](#-local-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Contact](#-contact)
- [License](#-license)

---

## ✨ Features

- 💰 Expense tracking and categorization
- 📊 Budget planning with progress visibility
- 📈 Financial analytics and trends
- 🌍 Multi-currency support with exchange rates
- 🔐 OAuth 2.0 login (Google)
- 💾 Optional Google Drive synchronization
- 📱 Responsive UI for desktop and mobile
- 🌙 Dark mode support
- 🌐 Internationalization support

---

## 🏗️ Architecture

This repository is a full-stack monorepo:

- `apps/backend` - Express API + Prisma
- `apps/frontend` - React + Vite SPA
- `docker-compose.dev.yml` - local PostgreSQL service

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Express + Prisma |
| Frontend | React 19 + Vite |
| Database | PostgreSQL 16 |
| Auth | better-auth |
| Styling | Tailwind CSS |

---

## 🚀 Quick Start (5 minutes)

### 1. Install prerequisites

- [Bun](https://bun.sh)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 2. Clone and install

```bash
git clone https://github.com/michalryskiewicz/saldoo.git
cd saldoo
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

### 4. Start local database

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 5. Run backend and frontend

```bash
bun run dev:backend
bun run dev:frontend
```

### 6. Open in browser

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Prisma Studio: http://localhost:5555

---

## 👨‍💻 Local Development

### Available scripts

```bash
bun run dev
bun run dev:backend
bun run dev:frontend
bun run build
bun run test
bun run lint
bun run lint:fix
bun run migrate
```

### Local `.env` example

```env
DATABASE_URL=postgresql://admin:root@localhost:5432/saldoo
BETTER_AUTH_SECRET=your_secret_min_32_characters
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
VITE_SERVER_URL=http://localhost:3000
VITE_GOOGLE_CLIENT=your_client_id.apps.googleusercontent.com
VITE_GA_DRIVE_DIRECTORY=rysiu-dev
VITE_GA_DRIVE_FILE=rysiu-dev-data.json
```

### Project structure

```text
saldoo/
├── apps/
│   ├── backend/
│   └── frontend/
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

---

## 🆘 Troubleshooting

### Database connection failed

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

### Reinstall dependencies

```bash
rm -rf node_modules
bun install
```

---

## 🤝 Contributing

Contributions are welcome. Please check `CONTRIBUTING.md` for the workflow and coding standards.

---

## 💬 Contact

- Website: [https://rysiuo.it](https://rysiuo.it)
- Email: kontakt@rysiuo.it

---

## 📄 License

This project is licensed under the MIT License. See `LICENSE` for details.
