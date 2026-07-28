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

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Express + Prisma |
| Frontend | React 19 + Vite |
| Your data | IndexedDB in the browser + an encrypted backup on your Google Drive |
| Server database | SQLite — a cache of public NBP rates, no user data |
| Auth | One Google OAuth token (identity + Drive), no server-side session |
| Styling | Tailwind CSS |

---

## 🚀 Quick Start (5 minutes)

### 1. Install prerequisites

- [Bun](https://bun.sh) — that's all. Docker is only needed for the production stack.

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

### 4. Create the local database

```bash
bun run migrate
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
bun run typecheck
bun run migrate
```

### Local `.env` example

```env
DATABASE_URL=postgresql://admin:root@localhost:5432/saldoo
FRONTEND_URL=http://localhost:5173
VITE_SERVER_URL=http://localhost:3000
VITE_GOOGLE_CLIENT=your_client_id.apps.googleusercontent.com
VITE_GA_DRIVE_DIRECTORY=rysiu-dev
VITE_GA_DRIVE_FILE=rysiu-dev-data.json
```

There is no OAuth client secret and no auth secret: the browser obtains its Google
token directly, and the backend has no session to sign.

### Google Cloud setup

One OAuth client (type: Web application) covers login and Drive:

1. **Publish the app** — OAuth consent screen → *Publish app*. While it is in
   *Testing*, Google expires consent after 7 days for any app requesting more than
   name/email/profile.
2. **Authorized JavaScript origins** — add your app's origin (e.g.
   `http://localhost:5173`). Google Identity Services will not start without it.
3. **Scopes** — `openid`, `email`, `profile`, and
   `https://www.googleapis.com/auth/drive.file`. All non-sensitive, so only basic
   verification applies and no security assessment is required.

### Project structure

```text
saldoo/
├── apps/
│   ├── backend/
│   └── frontend/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🆘 Troubleshooting

### Database issues

The database is one SQLite file holding only cached NBP rates, so recreating it is
always safe:

```bash
rm -rf apps/backend/prisma/data && bun run migrate
```

### Port already in use

```bash
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
