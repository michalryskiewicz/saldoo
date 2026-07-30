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
ARG VITE_GA_DRIVE_DIRECTORY
ARG VITE_GA_DRIVE_FILE
ARG VITE_ASSETS_DIR
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_UMAMI_SRC

ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_GOOGLE_CLIENT=$VITE_GOOGLE_CLIENT
ENV VITE_GA_DRIVE_DIRECTORY=$VITE_GA_DRIVE_DIRECTORY
ENV VITE_GA_DRIVE_FILE=$VITE_GA_DRIVE_FILE
ENV VITE_ASSETS_DIR=$VITE_ASSETS_DIR
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_SRC=$VITE_UMAMI_SRC

RUN bun run build

# Stage 2: Serve with nginx (small, production-grade)
FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/michalryskiewicz/saldoo"
LABEL org.opencontainers.image.description="Saldoo Frontend (Vite + React)"
LABEL org.opencontainers.image.licenses="UNLICENSED"

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/security-headers.conf.template /tmp/security-headers.conf.template

# The CSP has to name the two origins that differ per deployment: the API this
# bundle was built against, and the analytics host. Both are already baked into the
# bundle as build args, so the header is rendered from those same values — a CSP
# and a bundle that disagree about the API is the worst of both worlds.
#
# ARGs do not cross stages, so they are redeclared here.
ARG VITE_SERVER_URL
ARG VITE_UMAMI_SRC
ARG VITE_UMAMI_WEBSITE_ID

# envsubst gets an explicit variable list. Without it, nginx's own $uri and
# $document_root would be substituted away to nothing.
RUN set -eu; \
    origin() { printf '%s' "$1" | sed -nE 's#^(https?://[^/]+).*#\1#p'; }; \
    api="$(origin "${VITE_SERVER_URL:-}")"; \
    umami=""; \
    if [ -n "${VITE_UMAMI_WEBSITE_ID:-}" ]; then \
      umami="$(origin "${VITE_UMAMI_SRC:-https://cloud.umami.is/script.js}")"; \
    fi; \
    export CSP_SCRIPT_EXTRA="${umami:+ $umami}"; \
    export CSP_CONNECT_EXTRA="${api:+ $api}${umami:+ $umami}"; \
    mkdir -p /etc/nginx/snippets; \
    envsubst '${CSP_SCRIPT_EXTRA} ${CSP_CONNECT_EXTRA}' \
      < /tmp/security-headers.conf.template \
      > /etc/nginx/snippets/security-headers.conf; \
    rm /tmp/security-headers.conf.template; \
    nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

