# Multi-stage Dockerfile template для backend-расширения.
#
# Расширение должно скопировать этот файл к себе в репозиторий и кастомизировать
# при необходимости (например, добавить native deps). Базовый pattern:
#   1. install deps (cached layer)
#   2. build TypeScript → dist
#   3. runtime образ — только prod-deps + dist + healthcheck wget

# ───── builder ──────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ───── runtime ──────
FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Orchestrator опрашивает GET /_health после up -d
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/_health || exit 1

CMD ["node", "dist/main.js"]
