#!/usr/bin/env bash
# Сквозной прогон оплаты подписок хаб ↔ провайдер на чистой машине CI
# (B2D-32, workflow .github/workflows/billing-e2e.yaml).
#
# Стенд mono поднимает scripts/blackbox/stack.sh (env, image, infra, boot, app),
# этот скрипт достраивает к нему провайдер подключения и гоняет тест
# components/boot/src/tests/billing-tank.test.ts. Тест ведёт кооператив partner1
# с тарифом Стандарт через пробный период, первую оплату, объём месяца в бак
# AXON и квант при пустом баке — на сжатом времени (месяц = 30 минут).
#
# Сервер у хостера не арендуется: провайдер стартует с заведомо
# недействительным ключом Hostkey, заказ отказывает сразу. Для оплаты сервер не
# нужен — хаб платит провайдеру, а не серверу. Секретов прогон не требует:
# стенд одноразовый, ключи цепи — стандартные ключи dev-сети.
#
# Порядок фаз в workflow:
#   stack.sh env → image → infra → boot (EXTRA_RENT=1: partner1 активен и пайщик)
#   → billing-e2e.sh hub (хаб биллинга в .env контроллера)
#   → stack.sh app → billing-e2e.sh provider → tariff → test → collect → summary
#
# Использование: scripts/blackbox/billing-e2e.sh <hub|provider|tariff|test|collect|summary>
# Код провайдера — в $PROVIDER_DIR (workflow кладёт его в _provider).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${BLACKBOX_OUT:-$ROOT/.blackbox}"
mkdir -p "$OUT"
cd "$ROOT"

# shellcheck source=lib-env.sh
source "$ROOT/scripts/blackbox/lib-env.sh"

PROVIDER_DIR="${PROVIDER_DIR:-$ROOT/_provider}"
CTL_ENV=components/controller/.env
API_PORT=2998
CHAIN_PORT=8888
PROVIDER_PORT=3005
# Токен витрины провайдера: его шлёт хаб в каталог, его проверяет провайдер.
BEARER=billing-e2e-provider-bearer
# Сжатое время провайдера: сколько минут живёт месячная подписка.
PERIOD_MINUTES=30
COOP=partner1
TARIFF=standard

server_secret() { sed -n 's/^SERVER_SECRET=//p' "$CTL_ENV" | tail -1; }

chain_id() {
  curl -sf "http://127.0.0.1:${CHAIN_PORT}/v1/chain/get_info" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["chain_id"])'
}

# Ожидание с подписью: имя, секунд всего, пауза, команда-проверка.
wait_for() {
  local label="$1" total="$2" pause="$3"
  shift 3
  local deadline=$(( $(date +%s) + total ))
  until "$@" >/dev/null 2>&1; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "✗ не дождались: $label за ${total} с" >&2
      return 1
    fi
    sleep "$pause"
  done
  echo "✓ $label"
}

provider_compose() {
  (cd "$PROVIDER_DIR" && docker compose -p provider -f docker-compose.dev-stack.yml --env-file .env.dev-stack "$@")
}

provider_ready() {
  curl -sf -o /dev/null -H "Authorization: Bearer ${BEARER}" "http://127.0.0.1:${PROVIDER_PORT}/v1/subscription-types"
}

# Хаб биллинга — до `stack.sh app`: контроллер читает .env при старте.
# Такт оплат и такт бака — каждую минуту, иначе сжатый месяц обгоняет хаб.
cmd_hub() {
  set_env "$CTL_ENV" BILLING_HUB_MODE true
  set_env "$CTL_ENV" PROVIDER_BASE_URL "http://provider-backend:3000"
  set_env "$CTL_ENV" PROVIDER_BEARER_TOKEN "$BEARER"
  set_env "$CTL_ENV" BILLING_CRON_EXPRESSION '* * * * *'
  set_env "$CTL_ENV" BILLING_PACKAGE_CRON_EXPRESSION '* * * * *'
  set_env "$CTL_ENV" BILLING_PACKAGE_LOW_WATER_AXON 5
}

cmd_provider() {
  if [ ! -f "$PROVIDER_DIR/docker-compose.dev-stack.yml" ]; then
    echo "✗ нет кода провайдера в $PROVIDER_DIR" >&2
    exit 1
  fi
  local net="${COMPOSE_PROJECT_NAME:-blackbox}_default"
  cat > "$PROVIDER_DIR/.env.dev-stack" <<EOF
EXTERNAL_TESTNET_NETWORK=${net}
CHAIN_URL=http://node:8888
CHAIN_ID=$(chain_id)
# Компоуз передаёт пустую строку, а проверка окружения ждёт адрес — та же цепь стенда.
DEV_BLOCKCHAIN_API=http://node:8888
SERVER_SECRET=$(server_secret)
PROVIDER_BEARER_TOKEN=${BEARER}
PROVIDER_URL=http://coopback:${API_PORT}
# Аренды нет: ключ хостера недействителен по определению, заказ отказывает сразу.
HOSTKEY_API_KEY=billing-e2e-no-rent
# Раннер установки (Semaphore) стенду недоступен — адрес, который отказывает сразу.
SEMAPHORE_API_URL=http://127.0.0.1:9/api
BILLING_PERIOD_MINUTES=${PERIOD_MINUTES}
SUBSCRIPTION_POLICY_CRON="*/15 * * * * *"
SUBSCRIPTION_POLICY_AUTO_TERMINATION=false
HOSTKEY_TERMINATION_DRY_RUN=true
EOF
  # Дополнительные строки окружения от соседнего прогона (two-coop-e2e.sh:
  # каталог приложений и собственная установка partner1).
  if [ -n "${PROVIDER_EXTRA_ENV:-}" ]; then
    printf '%s\n' "$PROVIDER_EXTRA_ENV" >> "$PROVIDER_DIR/.env.dev-stack"
  fi
  provider_compose up -d --build backend
  if ! wait_for "провайдер отвечает" 900 10 provider_ready; then
    provider_compose logs --tail 200 backend || true
    exit 1
  fi
}

# Выбор тарифа — как его передаёт мастер подключения при подписании соглашения.
cmd_tariff() {
  curl -sf -X PUT -H 'Content-Type: application/json' -H "server-secret: $(server_secret)" \
    "http://127.0.0.1:${PROVIDER_PORT}/instances/${COOP}/tariff" \
    -d "{\"tariff_code\":\"${TARIFF}\",\"billing_period\":\"month\"}"
  echo
}

cmd_test() {
  cd components/boot
  CHAIN_URL="http://127.0.0.1:${CHAIN_PORT}" \
  API_URL="http://127.0.0.1:${API_PORT}/v1/graphql" \
  PROVIDER_URL="http://127.0.0.1:${PROVIDER_PORT}" \
  SERVER_SECRET="$(cd "$ROOT" && server_secret)" \
  PROVIDER_BEARER_TOKEN="$BEARER" \
  BILLING_PERIOD_MINUTES="$PERIOD_MINUTES" \
    pnpm exec vitest run src/tests/billing-tank.test.ts \
      --testTimeout=1500000 --hookTimeout=300000 \
      --reporter=default --reporter=junit --outputFile="$OUT/billing-tank.junit.xml"
}

provider_sql() {
  docker exec postgres-provider psql -U provider -d provider -c "$1" 2>&1 || true
}

cmd_collect() {
  mkdir -p "$OUT/logs"
  provider_compose logs --no-color --timestamps backend > "$OUT/logs/provider-backend.log" 2>&1 || true
  {
    echo "## Подписки ${COOP}"
    provider_sql "select id, subscription_type_id, status, is_trial, amount_per_period, started_at, expires_at, billing_anchor_day, packages_current_period_amount from subscriptions where instance_username='${COOP}' order by id"
    echo "## Счета"
    provider_sql "select kind, status, total_amount, items, created_at, paid_at from billing_invoice where coopname='${COOP}' order by created_at"
    echo "## Платежи"
    provider_sql "select subscription_id, amount, extended_days, transaction_id, payment_date from payments order by payment_date"
  } > "$OUT/provider-billing.txt"
}

cmd_summary() {
  local summary="${GITHUB_STEP_SUMMARY:-$OUT/summary.md}"
  {
    echo "## Billing E2E — оплата подписок хаб ↔ провайдер"
    echo
    if [ -s "$OUT/billing-tank.junit.xml" ]; then
      python3 - "$OUT/billing-tank.junit.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
print('| Шаг | Итог |')
print('|---|---|')
for case in root.iter('testcase'):
    failed = case.find('failure') is not None or case.find('error') is not None
    print(f"| {case.get('name')} | {'✗' if failed else '✓'} |")
PY
    else
      echo "_тест не запускался — стенд не поднялся, смотри шаги выше_"
    fi
    echo
    if [ -s "$OUT/provider-billing.txt" ]; then
      echo '<details><summary>Состояние биллинга провайдера</summary>'
      echo
      echo '```'
      cat "$OUT/provider-billing.txt"
      echo '```'
      echo '</details>'
    fi
  } >> "$summary"
}

case "${1:-}" in
  hub) cmd_hub ;;
  provider) cmd_provider ;;
  tariff) cmd_tariff ;;
  test) cmd_test ;;
  collect) cmd_collect ;;
  summary) cmd_summary ;;
  *) echo "использование: $0 <hub|provider|tariff|test|collect|summary>" >&2; exit 2 ;;
esac
