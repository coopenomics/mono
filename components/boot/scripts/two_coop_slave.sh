#!/usr/bin/env bash
# Ведомый кооператив связки двух локальных стендов (487-34):
#   pnpm run reboot:extra2coop:slave            (ведущий — ../mono-ai-5)
#   MASTER_DIR=../mono-ai-1 pnpm run reboot:extra2coop:slave
#
# Порядок связки: сначала ведущий (`pnpm run reboot:extra2coop:master` в его
# чекауте) — он поднимает цепь, заводит в ней кооператив partner1 и готовит
# провайдера; затем этот скрипт в ДРУГОМ чекауте поднимает узел partner1:
#
#   1. Чистит свои контейнеры и базы (цепь у ведомого своя не живёт).
#   2. Поднимает стенд поверх docker-compose.slave.yaml: вместо цепи —
#      ретранслятор на цепь ведущего, контроллер и оркестратор — partner1.
#   3. Ждёт контроллер и просит провайдера ведущего подключить узел
#      (POST /instances/partner1/attach): initSystem с данными организации,
#      стартовые AXON и powerup — те же шаги, что после поставки сервера.
#   4. Ставит совет: председатель партнёра с ключом кооператива проходит
#      установку (startInstall + installSystem), узел публикует ключ входа в
#      каталог partner1@catalog.
#   5. Печатает адреса и ссылку-приглашение председателя (пароль CoopID).
#
# Два чекаута, а не один: правка в одном перезапускает только его контроллер,
# и сервер не держит две компиляции разом.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"
stack_load_env

MASTER_DIR="$(cd "${MASTER_DIR:-$STACK_ROOT/../mono-ai-5}" && pwd)"
PROVIDER_DIR="${PROVIDER_DIR:-$HOME/provider}"
SLAVE_COOPNAME="${SLAVE_COOPNAME:-partner1}"

if [ "$MASTER_DIR" = "$STACK_ROOT" ]; then
  echo "✗ Ведущий и ведомый — один чекаут. Ведомый поднимается в другом: MASTER_DIR=<чекаут ведущего>"
  exit 1
fi

master_env() { grep -E "^$1=" "$MASTER_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }
MASTER_NODE_HTTP_PORT="$(master_env NODE_HTTP_PORT)"
MASTER_PROJECT="$(master_env COMPOSE_PROJECT_NAME)"
MASTER_PROJECT="${MASTER_PROJECT:-$(basename "$MASTER_DIR")}"
MASTER_CHAIN_ID="$(grep -E '^CHAIN_ID=' "$MASTER_DIR/components/controller/.env" | tail -1 | cut -d= -f2-)"
if [ -z "$MASTER_NODE_HTTP_PORT" ] || [ -z "$MASTER_CHAIN_ID" ]; then
  echo "✗ Не прочитать порт цепи и CHAIN_ID ведущего из $MASTER_DIR"
  exit 1
fi
if ! curl -sf -m 5 "http://127.0.0.1:${MASTER_NODE_HTTP_PORT}/v1/chain/get_info" >/dev/null; then
  echo "✗ Цепь ведущего не отвечает на :${MASTER_NODE_HTTP_PORT} — сначала reboot:extra2coop:master в $MASTER_DIR"
  exit 1
fi

# Секрет, которым провайдер вызывает initSystem узла. В dev-стеке провайдера
# по умолчанию SECRET (docker-compose.dev-stack.yml).
PROVIDER_SECRET="$(grep -E '^SERVER_SECRET=' "$PROVIDER_DIR/.env.dev-stack" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
PROVIDER_SECRET="${PROVIDER_SECRET:-SECRET}"
PROVIDER_URL="${PROVIDER_URL:-http://127.0.0.1:3005}"
# Токен чтения провайдера — узел берёт им цены приложений (как на боевом контуре).
PROVIDER_BEARER="$(grep -E '^PROVIDER_BEARER_TOKEN=' "$PROVIDER_DIR/.env.dev-stack" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"

# ── Конфигурация ведомого ────────────────────────────────────────────────────
mkdir -p "$STACK_ROOT/.two-coop"
# Ретранслятор ходит в чужие сети по именам контейнеров; имена резолвятся при
# каждом соединении (resolver docker), поэтому ещё не поднятый контейнер не
# роняет ретранслятор.
cat > "$STACK_ROOT/.two-coop/node-relay.conf" <<EOF
# Сгенерировано two_coop_slave.sh: цепь ведомого — цепь ведущего ($MASTER_DIR).
events {}
stream {
  resolver 127.0.0.11 valid=10s ipv6=off;
  map \$server_port \$relay_upstream {
    8888 ${MASTER_PROJECT}-node-1:8888;
    8070 ${MASTER_PROJECT}-node-1:8070;
    3001 apps-catalog-delivery:3001;
    3002 apps-catalog-operator:3002;
    8080 ${STACK_PROJECT}-nginx-1:80;
    3005 provider-backend:3000;
  }
  server {
    listen 8888;
    listen 8070;
    listen 3001;
    listen 3002;
    listen 8080;
    listen 3005;
    proxy_pass \$relay_upstream;
  }
}
EOF

# SLAVE_COMPOSE_EXTRA — оверлей между базовым и ведомым (в CI —
# scripts/blackbox/docker-compose.blackbox.yml: контроллер из dist под uid раннера).
export COMPOSE_FILE="docker-compose.yaml${SLAVE_COMPOSE_EXTRA:+:$SLAVE_COMPOSE_EXTRA}:docker-compose.slave.yaml"
export COOPNAME="$SLAVE_COOPNAME"
# Каталог — через ретранслятор `node`, в общую сеть каталога dev-стенда не входим.
export STACK_CATALOG_NET=0
export CHAIN_ID="$MASTER_CHAIN_ID"
export SLAVE_SERVER_SECRET="$PROVIDER_SECRET"
export SLAVE_PROVIDER_BEARER="$PROVIDER_BEARER"
export MASTER_NETWORK="${MASTER_PROJECT}_default"
export CATALOG_DELIVERY_BASE_URL="http://node:3001"
export APPS_CATALOG_OPERATOR_URL="http://node:3002"
export APPS_CATALOG_OPERATOR_API_KEY="${APPS_CATALOG_OPERATOR_API_KEY:-$(grep -E '^APPS_CATALOG_OPERATOR_API_KEY=' "$MASTER_DIR/components/controller/.env" | tail -1 | cut -d= -f2-)}"

cd "$STACK_ROOT"
echo "══ Ведомый кооператив $COOPNAME: стенд ${STACK_PROJECT}, цепь — ${MASTER_DIR} ══"

stack_wipe_containers
stack_wipe_volumes
docker compose rm -fsv node orchestrator >/dev/null 2>&1 || true

stack_up_infra
stack_up_authentik
echo "▸ Ретранслятор цепи ведущего..."
docker compose up -d node
stack_migrate_schema || exit 1
stack_up_app
docker compose up -d orchestrator

# ── Узел готов? ──────────────────────────────────────────────────────────────
# localhost, а не 127.0.0.1: nginx стенда переадресует 127.0.0.1 на localhost.
SLAVE_ORIGIN_HOST="http://localhost:${NGINX_HOST_PORT:-8108}"
SLAVE_ORIGIN_FOR_PROVIDER="http://${COOPNAME}-node:8080"
graphql_up() {
  curl -sf -m 5 -H 'content-type: application/json' \
    -d '{"query":"{ getSystemInfo { system_status } }"}' \
    "$SLAVE_ORIGIN_HOST/backend/v1/graphql" | grep -q system_status
}
# timing: timeout — контроллер компилируется ts-node: на занятой машине минуты
stack_wait_for "контроллер $COOPNAME" 180 5 graphql_up || exit 1

# ── Провайдер подключает узел ────────────────────────────────────────────────
echo "▸ Провайдер подключает узел $COOPNAME (initSystem, стартовые AXON)..."
attach() {
  curl -sf -m 120 -X POST "$PROVIDER_URL/instances/$COOPNAME/attach" \
    -H "server-secret: $PROVIDER_SECRET" -H 'content-type: application/json' \
    -d "{\"backend_origin\":\"$SLAVE_ORIGIN_FOR_PROVIDER\"}"
}
# timing: backoff — провайдер заводит инстанс синком с цепью раз в минуту
if ! stack_wait_for "подключение узла провайдером" 30 10 attach; then
  echo "✗ Провайдер не подключил узел. Проверь SELF_HOSTED_COOPS=$COOPNAME в $PROVIDER_DIR/.env.dev-stack"
  echo "  и логи: docker logs --since 5m provider-backend | grep -i $COOPNAME"
  exit 1
fi

# ── Совет и ключ входа в каталог ─────────────────────────────────────────────
# Установка совета заводит учётные записи в authentik: на свежем стенде он
# прогревается минуты, и запрос раньше времени обрывает установку.
authentik_users() {
  curl -sf -m 5 -o /dev/null \
    -H "Authorization: Bearer $(cat "$STACK_ROOT/infra/coopid/secrets/authentik_bootstrap_token")" \
    "http://127.0.0.1:${AUTHENTIK_HOST_PORT:-9008}/api/v3/core/users/?page_size=1"
}
# timing: timeout — authentik применяет схемы при первом старте
stack_wait_for "authentik принимает запросы" 120 5 authentik_users || exit 1
echo "▸ Установка совета $COOPNAME..."
(cd "$STACK_ROOT/components/boot" && \
  SLAVE_API_URL="$SLAVE_ORIGIN_HOST/backend/v1/graphql" \
  SLAVE_CHAIN_URL="http://127.0.0.1:${MASTER_NODE_HTTP_PORT}" \
  SLAVE_CHAIN_ID="$CHAIN_ID" \
  SLAVE_COOPNAME="$COOPNAME" \
  pnpm exec esno src/two-coop/install-slave.ts) || exit 1

INVITE="$(docker compose exec -T postgres psql -U "${POSTGRES_USERNAME:-postgres}" -d "${POSTGRES_DATABASE:-voskhod}" -tAc \
  "SELECT token FROM tokens WHERE type='invite' AND blacklisted=false AND expires > NOW() ORDER BY created_at DESC LIMIT 1" 2>/dev/null)"

# Председатель ведомого входит стандартным ключом dev-сети, как все пайщики
# стенда (решение владельца 25.10.2026): приглашение принимается здесь же —
# ключ председателя ставится мутацией resetKey по токену приглашения. Пароль
# владелец задаёт сам на рабочем столе.
STANDARD_PUB="$(cd "$STACK_ROOT/components/boot" && node -e "process.stdout.write(require('eosjs-ecc').privateToPublic('${PARTNER1_WIF:-5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3}'))")"
if [ -n "$INVITE" ] && [ -n "$STANDARD_PUB" ]; then
  RESET="$(curl -s -m 60 -H 'content-type: application/json' \
    -d "{\"query\":\"mutation(\$d: ResetKeyInput!){ resetKey(data: \$d) }\",\"variables\":{\"d\":{\"public_key\":\"$STANDARD_PUB\",\"token\":\"$INVITE\"}}}" \
    "$SLAVE_ORIGIN_HOST/backend/v1/graphql")"
  if echo "$RESET" | grep -q '"resetKey":true'; then
    echo "  ✓ председатель $COOPNAME: стандартный ключ ($STANDARD_PUB)"
    INVITE=""
  else
    echo "  ⚠ ключ председателя не установлен: $(echo "$RESET" | head -c 300)"
  fi
fi

stack_summary
FRONT="$(grep -E '^FRONTEND_URL=' "$STACK_ROOT/components/controller/.env" | tail -1 | cut -d= -f2-)"
echo
echo "── Связка двух кооперативов ─────────────────────────────────────"
echo "  Ведомый:   $COOPNAME  ${FRONT:-$SLAVE_ORIGIN_HOST}/$COOPNAME"
echo "  Председатель $COOPNAME: chairman.$COOPNAME@example.com, стандартный ключ dev-сети"
[ -n "$INVITE" ] && echo "  Приглашение председателя: ${FRONT:-$SLAVE_ORIGIN_HOST}/$COOPNAME/auth/invite?token=$INVITE"
echo "  Ведущий:   $MASTER_DIR (стол подключения voskhod — подписки и счёт $COOPNAME)"
echo "─────────────────────────────────────────────────────────────────"
