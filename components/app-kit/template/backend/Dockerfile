# Образ бэкенда приложения каталога: сборка и запуск подграфа GraphQL.
# Порт совпадает с coopenomics.backend.subgraphPort в package.json (3011).

# ───── builder ──────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Файл блокировки необязателен: каркас его не содержит, издатель добавляет
# свой после первой установки зависимостей.
# vendor/ — SDK приложений из чекаута mono, когда каркас создан набором из
# чекаута; у каркаса из npm папка пустая.
COPY package.json pnpm-lock.yaml* ./
COPY vendor ./vendor
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

COPY . .
RUN pnpm run build

# ───── runtime ──────
FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml* ./
COPY vendor ./vendor
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; else pnpm install --prod; fi && pnpm store prune

COPY --from=builder /app/dist ./dist

EXPOSE 3011

# Orchestrator опрашивает GET /_health после up -d
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3011/_health || exit 1

# Приложение — чужой код на узле кооператива: работает без прав root.
USER node
CMD ["node", "dist/main.js"]
