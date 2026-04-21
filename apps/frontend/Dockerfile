# Stage 1: Build Vite app
FROM oven/bun:alpine AS builder

LABEL org.opencontainers.image.source="https://github.com/michalryskiewicz/saldoo"
LABEL org.opencontainers.image.description="Saldoo Frontend (Vite + React)"
LABEL org.opencontainers.image.licenses="UNLICENSED"

# Build context is monorepo root
WORKDIR /app

# Copy root workspace manifests for layer caching
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/

# Install all workspace dependencies
RUN bun install

# Copy frontend source
COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend

# Vite build args (passed as Docker build args, baked in at build time)
ARG VITE_SERVER_URL
ARG VITE_GOOGLE_CLIENT
ARG VITE_GA_ID
ARG VITE_GA_DRIVE_DIRECTORY
ARG VITE_GA_DRIVE_FILE
ARG VITE_ASSETS_DIR

ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_GOOGLE_CLIENT=$VITE_GOOGLE_CLIENT
ENV VITE_GA_ID=$VITE_GA_ID
ENV VITE_GA_DRIVE_DIRECTORY=$VITE_GA_DRIVE_DIRECTORY
ENV VITE_GA_DRIVE_FILE=$VITE_GA_DRIVE_FILE
ENV VITE_ASSETS_DIR=$VITE_ASSETS_DIR

RUN bun run build

# Stage 2: Serve with nginx (small, production-grade)
FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/michalryskiewicz/saldoo"
LABEL org.opencontainers.image.description="Saldoo Frontend (Vite + React)"
LABEL org.opencontainers.image.licenses="UNLICENSED"

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

