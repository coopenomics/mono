#!/usr/bin/env bash
# Поднять mono dev-стек на macOS с нуля. Идемпотентно — можно гонять повторно.
# См. DEV-SETUP-MACOS.md для контекста.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

log() { printf '\033[1;36m[dev-setup] %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[dev-setup] %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[dev-setup] %s\033[0m\n' "$*" >&2; exit 1; }

# 1. Docker daemon
if ! docker info >/dev/null 2>&1; then
  log "Docker daemon не отвечает — пробую запустить Docker Desktop..."
  open -a Docker
  log "Жду готовности Docker daemon (до 3 мин)..."
  for _ in $(seq 1 180); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || die "Docker Desktop не запустился. Открой его руками и повтори."
fi

# 2. Снести зомби-контейнер coopback (если есть)
if docker ps -a --format '{{.Names}}' | grep -qx 'coopback'; then
  warn "Найден старый контейнер 'coopback' (не monocoop-*). Сношу — он дубль от components/controller/docker-compose.yml."
  docker stop coopback >/dev/null 2>&1 || true
  docker rm coopback >/dev/null 2>&1 || true
fi

# 3. Поднять стек
log "docker compose up -d"
docker compose up -d

# 4. Дождаться NodeOS RPC
log "Жду NodeOS RPC (http://localhost:8888)..."
for _ in $(seq 1 60); do
  curl -fsS --max-time 2 http://localhost:8888/v1/chain/get_info >/dev/null 2>&1 && break
  sleep 2
done
CHAIN_INFO=$(curl -fsS --max-time 5 http://localhost:8888/v1/chain/get_info) \
  || die "NodeOS RPC не отвечает. Глянь логи: docker logs monocoop-node-1"

LIVE_CHAIN_ID=$(printf '%s' "$CHAIN_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin)['chain_id'])")
log "Живой chain_id: $LIVE_CHAIN_ID"

# 5. Сверить и при необходимости подправить CHAIN_ID в .env
ENV_FILE="components/controller/.env"
if [[ -f "$ENV_FILE" ]]; then
  ENV_CHAIN_ID=$(grep -E '^CHAIN_ID=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
  if [[ "$ENV_CHAIN_ID" != "$LIVE_CHAIN_ID" ]]; then
    warn "CHAIN_ID в $ENV_FILE ($ENV_CHAIN_ID) != живому ($LIVE_CHAIN_ID). Обновляю."
    # macOS BSD sed
    sed -i '' "s|^CHAIN_ID=.*|CHAIN_ID=$LIVE_CHAIN_ID|" "$ENV_FILE"
    NEED_RECREATE=1
  fi
fi

# 6. Native binding libxmljs2 — проверить magic bytes, пересобрать если Mach-O
log "Проверяю libxmljs2 native binding..."
LIBXML_NODE=/app/node_modules/.pnpm/libxmljs2@0.37.0/node_modules/libxmljs2/build/Release/xmljs.node
MAGIC=$(docker exec monocoop-coopback-1 sh -c "head -c 4 $LIBXML_NODE 2>/dev/null | od -An -c | tr -d ' '" 2>/dev/null || echo "")
case "$MAGIC" in
  '177ELF'|*'ELF'*)
    log "libxmljs2 — Linux ELF, OK."
    ;;
  '')
    warn "libxmljs2 файла нет — собираю..."
    REBUILD_XMLJS=1
    ;;
  *)
    warn "libxmljs2 не Linux ELF ($MAGIC) — пересобираю под Linux..."
    REBUILD_XMLJS=1
    ;;
esac

if [[ "${REBUILD_XMLJS:-0}" == "1" ]]; then
  docker exec monocoop-coopback-1 sh -c '
    cd /app/node_modules/.pnpm/libxmljs2@0.37.0/node_modules/libxmljs2 \
    && rm -rf build \
    && PATH="$PWD/node_modules/.bin:$PATH" npm run install
  '
  NEED_RECREATE=1
fi

# 7. Если что-то правили — пересоздать контейнеры
if [[ "${NEED_RECREATE:-0}" == "1" ]]; then
  log "Пересоздаю coopback/cooparser, чтобы подхватить новый env / новые бинарники..."
  docker compose up -d --force-recreate --no-deps coopback cooparser
fi

# 8. Дождаться coopback HTTP
log "Жду пока coopback ответит по http://localhost:2998/v1/graphql (cold-start ts-node ~5–6 мин)..."
DEADLINE=$(($(date +%s) + 600))
while [[ $(date +%s) -lt $DEADLINE ]]; do
  if curl -fsS --max-time 3 -X POST -H 'Content-Type: application/json' \
       -d '{"query":"{__typename}"}' http://localhost:2998/v1/graphql >/dev/null 2>&1; then
    log "Coopback готов."
    break
  fi
  if docker logs --tail 5 monocoop-coopback-1 2>&1 | grep -qiE 'crashed|FATAL|invalid ELF|ERR_INVALID_PACKAGE'; then
    docker logs --tail 60 monocoop-coopback-1
    die "Coopback падает — см. логи выше."
  fi
  sleep 5
done

log "Готово. Backend: http://localhost:2998/v1/graphql"
log "Опц. сервисы: docker compose --profile search up -d opensearch"
