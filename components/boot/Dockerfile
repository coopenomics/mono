# Образ-bootstrap для удалённой ноды.
#
# Назначение: one-shot job в чужом docker-compose рядом с уже
# запущенным `node`-сервисом (dicoop/blockchain). Bootstrap
# дожидается готовности RPC, после чего вкатывает на ноду все
# системные и кооперативные контракты, активирует протокол-фичи,
# создаёт системный токен и инициализирует system/emission/powerup.
#
# Контракты НЕ собираются здесь — они тянутся multi-stage из
# готового артефакта `dicoop/contracts:<tag>`.
#
# Сборка идёт в три стадии:
#   1. builder   — full workspace + pnpm install + unbuild
#                  (workspace-deps cooptypes/factory inline'ятся в
#                  bundle, npm-deps остаются external)
#   2. contracts — dicoop/contracts:<tag>
#   3. runtime   — slim node:22 + bundle + npm install --omit=dev
#
# Окружение:
#   CHAIN_URL              — endpoint удалённой ноды
#   CONTRACTS_DIR=/contracts
#   RPC_WAIT_TIMEOUT_MS    — default 120000
#   EOSIO_PUB_KEY / EOSIO_PRV_KEY
#   INSTALL_INITIAL_DATA=1 — опционально mono-данные (нужны MONGO_URI/POSTGRES_*)
#   INSTALL_EXTRA_DATA=1   — то же + расширенный совет

ARG CONTRACTS_TAG=latest

# ─── Stage 1: builder ─────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@10.33.0

COPY . .

# --ignore-scripts + точечный rebuild: --filter ограничивает только то, какие
# проекты получают node_modules, но НЕ то, для каких пакетов общего lockfile
# store выполняет lifecycle-скрипты при --frozen-lockfile. Без --ignore-scripts
# сюда тянутся electron/puppeteer (из @coopenomics/desktop/notifications,
# boot их не использует) — тяжёлые сетевые загрузки, изредка валящие билд по
# TLS-таймауту. rebuild --filter уже честно скопирован на подграф boot.
RUN pnpm install --frozen-lockfile --filter "@coopenomics/boot..." --ignore-scripts \
 && pnpm rebuild --filter "@coopenomics/boot..."

# Билд графа: cooptypes/factory собирают свои dist/, boot собирает
# свой bundle с inlined workspace-deps.
RUN pnpm --filter "@coopenomics/boot..." build

# Workspace-deps inline'ятся в bundle, их транзитивные npm-deps (handlebars/
# ajv/mongodb у factory, wharfkit/graphql/ws у sdk) мерджим в boot.deps —
# нужны в runtime. Cooptypes type-only — его @typescript-eslint/parser в
# runtime не нужен и конфликтует с eslint v9 в boot.devDeps по peer-spec'ам.
# Сами workspace-spec'и снимаем ПО ПРИЗНАКУ, а не по списку имён: npm не
# понимает `workspace:*` и валит сборку образа с EUNSUPPORTEDPROTOCOL, а
# список имён устаревает молча — так было, когда boot объявил зависимость
# от sdk и образ упал, хотя пакеты собрались.
RUN node -e "const fs=require('fs'); \
  const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8')); \
  const boot=read('components/boot/package.json'); \
  const factory=read('components/factory/package.json'); \
  const sdk=read('components/sdk/package.json'); \
  boot.dependencies = { ...factory.dependencies, ...sdk.dependencies, ...boot.dependencies }; \
  for (const name of Object.keys(boot.dependencies)) { \
    if (String(boot.dependencies[name]).startsWith('workspace:')) delete boot.dependencies[name]; \
  } \
  fs.writeFileSync('components/boot/package.json', JSON.stringify(boot, null, 2));"

# ─── Stage 2: contracts ───────────────────────────────────────────────
FROM dicoop/contracts:${CONTRACTS_TAG} AS contracts

# ─── Stage 3: runtime ────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

COPY --from=builder /app/components/boot/package.json ./package.json
COPY --from=builder /app/components/boot/dist ./dist

# Только prod npm-зависимости. --no-package-lock потому что
# pnpm-lock несовместим с npm и в slim-образе не нужен.
RUN npm install --omit=dev --no-package-lock --no-fund --no-audit --legacy-peer-deps \
 && npm cache clean --force \
 && rm -rf /root/.npm

COPY --from=contracts /contracts /contracts
ENV CONTRACTS_DIR=/contracts

ENTRYPOINT ["node", "dist/index.cjs"]
CMD ["boot:remote"]
