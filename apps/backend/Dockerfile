FROM oven/bun:alpine

# OCI Labels
LABEL org.opencontainers.image.source="https://github.com/michalryskiewicz/saldoo"
LABEL org.opencontainers.image.description="Saldoo Backend (Bun + Express + Prisma)"
LABEL org.opencontainers.image.licenses="UNLICENSED"

# Build context is monorepo root
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/

# Install all workspace dependencies
RUN bun install

# Copy Prisma schema and generate client (no DB connection required)
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/backend && bunx prisma generate

# Copy backend source
COPY apps/backend ./apps/backend

# Remove any accidentally copied .env files
RUN find /app -name ".env" -delete; find /app -name ".env.local" -delete; find /app -name ".env.production" -delete; exit 0

EXPOSE 3000

WORKDIR /app/apps/backend

# Environment variables provided at runtime via docker-compose / Coolify
CMD ["bun", "run", "index.ts"]
