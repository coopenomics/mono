# Multi-stage build для `dicoop/mono-base`.
#
# Стадии:
#   1. builder — full toolchain: pnpm + lerna + apt dev-headers (gcc,
#      libcairo2-dev, ...) + WeasyPrint в venv. Здесь делаются
#      `pnpm install` (с devDeps), `lerna run build`, потом
#      `pnpm prune --prod` (devDeps выкидываются из workspace
#      node_modules — экономит ~1.5GB).
#   2. runtime — slim образ без dev-headers и без gcc. Только runtime
#      libs WeasyPrint + готовый /app + venv. Глобальные pnpm/lerna
#      ставятся отдельно для удобного запуска `pnpm -F <pkg> run start`.
#
# Финальный размер: ~1-1.5GB (вместо 7.36GB в одностадийной сборке).
# Все потребители mono-base (controller/desktop/parser/notifications/
# notificator/boot) пользуются одним и тем же тонким runtime-образом
# через `FROM dicoop/mono-base:<tag>` + `CMD`.

# ── Stage 1: builder ──────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Build-time системные deps. Тяжёлые `-dev`-пакеты (для компиляции
# native-bindings + WeasyPrint native deps) сюда, в runtime их не
# тащим. `--no-install-recommends` экономит ещё ~150MB.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      build-essential gcc g++ python3-dev \
      libcairo2-dev libffi-dev libjpeg-dev libopenjp2-7-dev zlib1g-dev \
      libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 \
      shared-mime-info \
 && rm -rf /var/lib/apt/lists/*

# WeasyPrint в venv — переедет в runtime-stage целиком через COPY.
RUN python3 -m venv /venv \
 && /venv/bin/pip install --no-cache-dir WeasyPrint==67

RUN npm install -g pnpm lerna --no-fund --no-audit

# Сначала манифесты (для кэш-friendly install). `.dockerignore` уже
# выкидывает node_modules/dist/.git, поэтому `COPY .` лёгкий.
COPY . .

# Используем существующий lockfile. Если он не совпадает с workspace —
# падать сразу, не дрейфовать незаметно.
RUN pnpm install --frozen-lockfile

# Сборка всех пакетов через lerna-граф (зависимости собираются в
# правильном порядке). Никаких --filter — пусть собирается всё, чтобы
# образ годился любому потребителю mono-base.
RUN lerna run build

# Удалить devDeps из всех workspace node_modules. Это и есть основная
# оптимизация размера — typescript, vitest, eslint, unbuild, ts-node-cli,
# desktop-сборщики и пр. удаляются из финального дерева.
#
#  - `CI=true` отключает интерактивный prompt («вы уверены что снести
#    modules?») — без TTY pnpm иначе абортится с
#    ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
#  - `--ignore-scripts` подавляет lifecycle hooks (prepare/postinstall)
#    после prune. Иначе pnpm дёргает `quasar prepare` в desktop'е,
#    а quasar (devDep) уже снесён → ELIFECYCLE.
#
# Все production-сервисы переведены на runtime без devDeps:
#   cooparser     → `node ./dist/index.cjs`
#   notifications → `node ./dist/sync/sync-runner.cjs` (entry добавлен в unbuild)
#   coopback      → `ts-node` + `tsconfig-paths` (оба в deps)
#   desktop       → `node dist/ssr/index.js`
#   boot:remote   → `node /app/components/boot/dist/index.cjs boot:remote`
RUN CI=true pnpm prune --prod --ignore-scripts

# ── Stage 2: runtime ──────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Только runtime-библиотеки WeasyPrint (без `-dev` headers и без gcc).
# `python3` нужен потому что venv в /venv/bin/python — символическая
# ссылка на системный интерпретатор; без него `weasyprint` падает с
# `python: not found`. `procps`/`wget` — для дебага/healthcheck'ов
# из docker-compose.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 \
      libffi8 libjpeg62-turbo libopenjp2-7 zlib1g shared-mime-info \
      procps wget \
 && rm -rf /var/lib/apt/lists/*

# Python venv с WeasyPrint, готовый к использованию.
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# Приложение целиком (с уже урезанными до prod node_modules).
COPY --from=builder /app /app

# Глобальные pnpm/lerna — нужны чтобы потребители mono-base могли
# делать `CMD ["pnpm","-F","<pkg>","run","start"]` в production.
RUN npm install -g pnpm lerna --no-fund --no-audit

# Sanity-check: WeasyPrint работает и виден через PATH.
RUN weasyprint --version
