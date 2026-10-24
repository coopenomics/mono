#!/usr/bin/env bash
# Сквозной прогон приложения каталога на связке двух кооперативов в CI
# (487-34, задание two-coop в .github/workflows/billing-e2e.yaml).
#
# Ведущий кооператив voskhod поднимает scripts/blackbox/stack.sh (цепь,
# контроллер-хаб биллинга). Этот скрипт достраивает остальное и гоняет тест
# components/boot/src/tests/catalog-apps-two-coop.test.ts: подписка partner1 на
# приложение у провайдера → строка общего счёта → оплата хабом → установка на
# узле partner1 → отмена → снятие.
#
#   catalog   каталог приложений из $CATALOG_DIR: базы, Nexus, catalog-delivery,
#             catalog-operator (оверлей two-coop/catalog.overlay.yml — сеть
#             ведущего и порты хоста)
#   fixture   демо-приложение @voskhod/demoapp: архив в Nexus, пакет, активный
#             выпуск, цена плана default. Путь издателя (подпись, модерация)
#             сценарий не проверяет — пакет кладётся фикстурой
#   provider  провайдер (billing-e2e.sh provider) с каналом каталога и
#             собственной установкой partner1 (SELF_HOSTED_COOPS)
#   permission разрешение voskhod@provider в цепи — им провайдер подписывает
#             канал оператора каталога
#   slave     узел partner1 — копия рабочей папки в $SLAVE_DIR (исходники из git,
#             node_modules и сборки — жёсткими ссылками), свой .env с другими
#             портами, components/boot/scripts/two_coop_slave.sh
#   test      сценарий полного пути
#   collect / summary — логи и сводка
#
# Секретов прогон не требует: стенд одноразовый, ключи генерируются на месте.
# Использование: scripts/blackbox/two-coop-e2e.sh <catalog|fixture|provider|permission|slave|test|collect|summary>

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${BLACKBOX_OUT:-$ROOT/.blackbox}"
mkdir -p "$OUT"
cd "$ROOT"

CATALOG_DIR="${CATALOG_DIR:-$ROOT/_catalog}"
PROVIDER_DIR="${PROVIDER_DIR:-$ROOT/_provider}"
SLAVE_DIR="${SLAVE_DIR:-$(dirname "$ROOT")/two-coop-slave}"
CTL_ENV=components/controller/.env
CHAIN_PORT=8888
API_PORT=2998
PROVIDER_PORT=3005
OPERATOR_PORT=3002
NEXUS_PORT=8081
NEXUS_PASSWORD=a-very-strong-password-1234 # дефолт compose каталога (NEXUS_ADMIN_PASSWORD)
NEXUS_REPO=npm-hosted
ADMIN_API_KEY=dev-fixture-admin-api-key-DO-NOT-USE-IN-PROD-12345 # дефолт compose каталога
BEARER=billing-e2e-provider-bearer # тот же, что в billing-e2e.sh
PERIOD_MINUTES=30
MASTER_NETWORK="${COMPOSE_PROJECT_NAME:-blackbox}_default"
SLAVE_ORCH_PORT=4001
PACKAGE=@voskhod/demoapp
# Файл с ключом провайдера: им подписан канал оператора, его открытая часть —
# разрешение voskhod@provider.
PROVIDER_KEY_FILE="$OUT/.catalog-provider-key"

server_secret() { sed -n 's/^SERVER_SECRET=//p' "$ROOT/$CTL_ENV" | tail -1; }

chain_id() {
  curl -sf "http://127.0.0.1:${CHAIN_PORT}/v1/chain/get_info" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["chain_id"])'
}

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

catalog_compose() {
  (cd "$CATALOG_DIR" && docker compose -p apps-catalog \
    -f docker-compose.yml -f "$ROOT/scripts/blackbox/two-coop/catalog.overlay.yml" \
    --env-file .env.two-coop "$@")
}

# ── каталог ──────────────────────────────────────────────────────────────────
cmd_catalog() {
  if [ ! -f "$CATALOG_DIR/docker-compose.yml" ]; then
    echo "✗ нет кода каталога в $CATALOG_DIR" >&2
    exit 1
  fi
  # Пара ключей JWT каталога — на прогон (Ed25519, общего секрета нет).
  local keys
  keys="$(node -e '
    const k = require("node:crypto").generateKeyPairSync("ed25519");
    console.log(k.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"));
    console.log(k.publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  ')"
  cat > "$CATALOG_DIR/.env.two-coop" <<EOF
MASTER_NETWORK=${MASTER_NETWORK}
CATALOG_JWT_PRIVATE_KEY=$(echo "$keys" | sed -n 1p)
CATALOG_JWT_PUBLIC_KEY=$(echo "$keys" | sed -n 2p)
CATALOG_OPERATOR_ACCOUNT=voskhod
CATALOG_OPERATOR_CHAIN_RPC_URL=http://node:8888
CATALOG_OPERATOR_CHAIN_ID=$(chain_id)
ADMIN_API_KEY=${ADMIN_API_KEY}
NEXUS_ADMIN_PASSWORD=${NEXUS_PASSWORD}
NEXUS_NPM_REPO=${NEXUS_REPO}
EOF
  catalog_compose up -d --build postgres redis nexus migrate catalog-delivery catalog-operator
  wait_for "catalog-delivery" 600 5 curl -sf "http://127.0.0.1:3001/health"
  wait_for "catalog-operator" 600 5 curl -sf "http://127.0.0.1:${OPERATOR_PORT}/health"
}

nexus_up() { curl -sf "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/status/writable"; }

# ── фикстура демо-приложения ────────────────────────────────────────────────
cmd_fixture() {
  # Nexus стартует минуты: пароль администратора при первом старте лежит в файле.
  wait_for "Nexus принимает запись" 900 10 nexus_up
  if ! curl -sf -o /dev/null -u "admin:${NEXUS_PASSWORD}" "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/repositories"; then
    local initial
    initial="$(docker exec apps-catalog-nexus cat /nexus-data/admin.password)"
    curl -sf -u "admin:${initial}" -X PUT -H 'Content-Type: text/plain' --data "$NEXUS_PASSWORD" \
      "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/security/users/admin/change-password"
  fi
  if ! curl -sf -o /dev/null -u "admin:${NEXUS_PASSWORD}" "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/repositories/${NEXUS_REPO}"; then
    curl -sf -u "admin:${NEXUS_PASSWORD}" -X POST -H 'Content-Type: application/json' \
      "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/repositories/npm/hosted" \
      -d "{\"name\":\"${NEXUS_REPO}\",\"online\":true,\"storage\":{\"blobStoreName\":\"default\",\"strictContentTypeValidation\":true,\"writePolicy\":\"ALLOW\"}}"
  fi
  echo "✓ Nexus: репозиторий ${NEXUS_REPO}"

  local app="$CATALOG_DIR/examples/demo-app" version tgz
  version="$(node -p "require('$app/package.json').version")"
  # Архив — npm pack, загрузка — REST API компонентов Nexus с паролем
  # администратора: npm publish по базовой авторизации Nexus отвергает (403).
  tgz="$(cd "$app" && npm pack --silent --pack-destination "$OUT")"
  if ! curl -sf -o /dev/null -u "admin:${NEXUS_PASSWORD}" \
      "http://127.0.0.1:${NEXUS_PORT}/repository/${NEXUS_REPO}/${PACKAGE}"; then
    curl -sf -u "admin:${NEXUS_PASSWORD}" -X POST \
      -F "npm.asset=@${OUT}/${tgz};type=application/x-compressed" \
      "http://127.0.0.1:${NEXUS_PORT}/service/rest/v1/components?repository=${NEXUS_REPO}"
  fi
  wait_for "${PACKAGE} в репозитории Nexus" 60 3 \
    curl -sf -o /dev/null -u "admin:${NEXUS_PASSWORD}" "http://127.0.0.1:${NEXUS_PORT}/repository/${NEXUS_REPO}/${PACKAGE}"
  echo "✓ ${PACKAGE}@${version} в Nexus"

  local subnet
  subnet="$(chain_id)"
  docker exec -i apps-catalog-postgres psql -v ON_ERROR_STOP=1 -q -U catalog_app -d catalog_operator <<SQL
INSERT INTO packages (package_id, owner_username, compatible_subnets)
VALUES ('${PACKAGE}', 'voskhod', ARRAY['${subnet}'])
ON CONFLICT (package_id) DO UPDATE SET compatible_subnets = EXCLUDED.compatible_subnets;
INSERT INTO releases (package_id, version, status, scope, moderated_by, published_at, updated_at)
VALUES ('${PACKAGE}', '${version}', 'ACTIVE', '{"type":"all"}', 'moderator', now(), now())
ON CONFLICT (package_id, version) DO UPDATE SET status = 'ACTIVE', scope = '{"type":"all"}';
SQL
  # Цена плана default: 0.5 RUB в час — 360 ₽ за месяц стенда.
  curl -sf -X POST "http://127.0.0.1:${OPERATOR_PORT}/v1/admin/pricing" \
    -H "Authorization: Bearer ${ADMIN_API_KEY}" -H 'Content-Type: application/json' \
    -d '{"package_id":"demoapp","plan":"default","hourly_rate":"0.5000 RUB"}'
  echo
  wait_for "install.js демо-приложения отдаётся" 120 5 \
    curl -sf -o /dev/null -H "Authorization: Bearer ${ADMIN_API_KEY}" \
      "http://127.0.0.1:${OPERATOR_PORT}/v1/public/packages/voskhod/demoapp/install.js"
}

# ── провайдер ────────────────────────────────────────────────────────────────
cmd_provider() {
  if [ ! -s "$PROVIDER_KEY_FILE" ]; then
    (cd components/boot && node -e "require('eosjs-ecc').randomKey().then(k => process.stdout.write(k))") > "$PROVIDER_KEY_FILE"
  fi
  PROVIDER_EXTRA_ENV="$(cat <<EOF
SELF_HOSTED_COOPS=partner1
CATALOG_OPERATOR_URL=http://apps-catalog-operator:3002
CATALOG_OPERATOR_ACCOUNT=voskhod
CATALOG_PROVIDER_KEY=$(cat "$PROVIDER_KEY_FILE")
EOF
)" bash scripts/blackbox/billing-e2e.sh provider
}

cmd_permission() {
  (cd components/boot && CATALOG_PROVIDER_KEY="$(cat "$PROVIDER_KEY_FILE")" pnpm exec esno src/two-coop/provider-permission.ts)
}

# ── ведомый узел partner1 ───────────────────────────────────────────────────
# Второй чекаут: исходники — из git (настоящие файлы, их правят скрипты стенда),
# node_modules, сборки пакетов и секреты CoopID — жёсткими ссылками на ведущего:
# мгновенно и без места на диске. Файлы, которые стенд переписывает, —
# отдельные копии.
make_slave_dir() {
  rm -rf "$SLAVE_DIR"
  mkdir -p "$SLAVE_DIR"
  git ls-files -z | (cd "$ROOT" && cpio -0pdm --quiet "$SLAVE_DIR")
  local d
  while IFS= read -r d; do
    mkdir -p "$SLAVE_DIR/$(dirname "$d")"
    cp -al "$ROOT/$d" "$SLAVE_DIR/$d"
  done < <(find . -maxdepth 3 \( -name node_modules -o -name dist \) -type d -not -path './.git/*' -not -path './_*' -prune -printf '%P\n')
  cp -a infra/coopid/secrets "$SLAVE_DIR/infra/coopid/" 2>/dev/null || true
  cp "$CTL_ENV" "$SLAVE_DIR/$CTL_ENV"
  cp components/boot/.env "$SLAVE_DIR/components/boot/.env"
  # Свой проект компоуза и свои порты хоста: ведущий уже занял стандартные.
  sed -e 's/^COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=slave/' \
      -e '/^\(NODE_HTTP_PORT\|COOPBACK_HOST_PORT\|POSTGRES_PORT\|DESKTOP_HOST_PORT\|NGINX_HOST_PORT\|API_URL\)=/d' \
      .env > "$SLAVE_DIR/.env"
  cat >> "$SLAVE_DIR/.env" <<EOF
NODE_HTTP_PORT=18888
NODE_P2P_PORT=19876
NODE_HISTORY_PORT=18070
COOPBACK_HOST_PORT=3998
POSTGRES_PORT=5533
PG_HOST_PORT=5533
MONGO_HOST_PORT=27018
REDIS_HOST_PORT=6380
MINIO_HOST_PORT=9100
MINIO_CONSOLE_HOST_PORT=9101
AUTHENTIK_HOST_PORT=9018
DESKTOP_HOST_PORT=3999
ORCHESTRATOR_HOST_PORT=${SLAVE_ORCH_PORT}
NGINX_HOST_PORT=8109
API_URL=http://127.0.0.1:3998/v1/graphql
EOF
}

cmd_slave() {
  make_slave_dir
  (cd "$SLAVE_DIR" && \
    MASTER_DIR="$ROOT" PROVIDER_DIR="$PROVIDER_DIR" STACK_SKIP_DESKTOP=1 \
    SLAVE_COMPOSE_EXTRA=scripts/blackbox/docker-compose.blackbox.yml \
    APPS_CATALOG_OPERATOR_API_KEY="$ADMIN_API_KEY" \
    bash components/boot/scripts/two_coop_slave.sh)
}

# ── тест ─────────────────────────────────────────────────────────────────────
cmd_test() {
  cd components/boot
  CHAIN_URL="http://127.0.0.1:${CHAIN_PORT}" \
  API_URL="http://127.0.0.1:${API_PORT}/v1/graphql" \
  PROVIDER_URL="http://127.0.0.1:${PROVIDER_PORT}" \
  SERVER_SECRET="$(cd "$ROOT" && server_secret)" \
  PROVIDER_BEARER_TOKEN="$BEARER" \
  BILLING_PERIOD_MINUTES="$PERIOD_MINUTES" \
  SLAVE_ORCHESTRATOR_URL="http://127.0.0.1:${SLAVE_ORCH_PORT}" \
    pnpm exec vitest run src/tests/catalog-apps-two-coop.test.ts \
      --testTimeout=600000 --hookTimeout=300000 \
      --reporter=default --reporter=junit --outputFile="$OUT/two-coop.junit.xml"
}

cmd_collect() {
  mkdir -p "$OUT/logs"
  local c
  for c in apps-catalog-delivery apps-catalog-operator apps-catalog-migrate apps-catalog-nexus; do
    docker logs --timestamps "$c" > "$OUT/logs/$c.log" 2>&1 || true
  done
  for c in coopback orchestrator node nginx parser2; do
    docker logs --timestamps "slave-$c-1" > "$OUT/logs/slave-$c.log" 2>&1 || true
  done
  (cd "$PROVIDER_DIR" && docker compose -p provider -f docker-compose.dev-stack.yml --env-file .env.dev-stack logs --no-color --timestamps backend) \
    > "$OUT/logs/provider-backend.log" 2>&1 || true
}

cmd_summary() {
  local summary="${GITHUB_STEP_SUMMARY:-$OUT/summary.md}"
  {
    echo "## Two-coop E2E — приложение каталога на связке двух кооперативов"
    echo
    if [ -s "$OUT/two-coop.junit.xml" ]; then
      python3 - "$OUT/two-coop.junit.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
print('| Шаг | Итог |')
print('|---|---|')
for case in root.iter('testcase'):
    failed = case.find('failure') is not None or case.find('error') is not None
    print(f"| {case.get('name')} | {'✗' if failed else '✓'} |")
PY
    else
      echo "_тест не запускался — связка не поднялась, смотри шаги выше_"
    fi
  } >> "$summary"
}

case "${1:-}" in
  catalog) cmd_catalog ;;
  fixture) cmd_fixture ;;
  provider) cmd_provider ;;
  permission) cmd_permission ;;
  slave) cmd_slave ;;
  test) cmd_test ;;
  collect) cmd_collect ;;
  summary) cmd_summary ;;
  *) echo "использование: $0 <catalog|fixture|provider|permission|slave|test|collect|summary>" >&2; exit 2 ;;
esac
