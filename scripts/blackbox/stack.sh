#!/usr/bin/env bash
# Стенд для внешнего слоя тестов (black-box) на чистой машине CI — C28-80.
#
# Внешний слой разговаривает с платформой только через её API, как интерфейс
# или посторонний клиент, поэтому ему нужен стенд целиком: цепь, индексер,
# контроллер, базы, файловое хранилище и CoopID. Скрипт повторяет
# components/boot/scripts/extra_reboot.sh и берёт шаги из той же библиотеки
# lib/stack.sh. Отличия от dev-стенда:
#   - нет рабочего стола и nginx: тестам нужен только API;
#   - контроллер стартует из собранного dist, а не через ts-node (быстрее, и
#     ближе к тому, что крутится на узлах кооперативов);
#   - контейнеры работают под uid раннера (docker-compose.blackbox.yml);
#   - каждая фаза — отдельный подкоманд, чтобы workflow видел время каждой.
#
# Использование: scripts/blackbox/stack.sh <env|image|infra|boot|app|seed|tests|apitests|rights|dbcov|collect|summary>

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${BLACKBOX_OUT:-$ROOT/.blackbox}"
mkdir -p "$OUT"
cd "$ROOT"

PG_PASSWORD='postgres!23!23' # тот же, что в docker-compose.yaml у сервиса postgres
API_PORT=2998
CHAIN_PORT=8888

# Заменяет значение ключа в .env-файле или дописывает ключ, если его нет.
set_env() {
  local file="$1" key="$2" value="$3"
  KEY="$key" VALUE="$value" awk -v k="$key" '
    BEGIN { FS = OFS = "=" ; done = 0 }
    $1 == k { print k "=" ENVIRON["VALUE"]; done = 1; next }
    { print }
    END { if (!done) print k "=" ENVIRON["VALUE"] }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

load_stack() {
  # shellcheck source=../../components/boot/scripts/lib/stack.sh
  source "$ROOT/components/boot/scripts/lib/stack.sh"
  stack_load_env
}

chain_id() {
  curl -sf "http://127.0.0.1:${CHAIN_PORT}/v1/chain/get_info" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["chain_id"])'
}

api_ready() {
  curl -sf -o /dev/null -X POST -H 'Content-Type: application/json' \
    --data '{"query":"{ __typename }"}' "http://127.0.0.1:${API_PORT}/v1/graphql"
}

cmd_env() {
  # Фаза переписывает корневой .env и .env контроллера. На dev-машине это снесло
  # бы настройки живого стенда, поэтому вне CI — только по явному разрешению.
  if [ "${CI:-}" != "true" ] && [ "${BLACKBOX_FORCE:-}" != "1" ]; then
    echo "✗ фаза env переписывает .env стенда; вне CI запускать с BLACKBOX_FORCE=1" >&2
    exit 1
  fi
  # Корневой .env читают и компоуз (подстановки), и lib/stack.sh, и boot.
  cat > .env <<EOF
COMPOSE_PROJECT_NAME=blackbox
HOST_UID=$(id -u)
HOST_GID=$(id -g)
NODE_HTTP_PORT=${CHAIN_PORT}
COOPBACK_HOST_PORT=${API_PORT}
CHAIN_URL=http://127.0.0.1:${CHAIN_PORT}
API_URL=http://127.0.0.1:${API_PORT}/v1/graphql
MONGODB_URL=mongodb://127.0.0.1:27017/?directConnection=true
MONGO_URI=mongodb://127.0.0.1:27017/cooperative-x?directConnection=true
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5532
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DATABASE=voskhod
COOPNAME=voskhod
EOF

  # boot работает на хосте и ходит в сервисы через проброшенные порты.
  local boot_env=components/boot/.env
  cp components/boot/.env-example "$boot_env"
  set_env "$boot_env" POSTGRES_PORT 5532
  set_env "$boot_env" POSTGRES_PASSWORD "$PG_PASSWORD"
  set_env "$boot_env" CHAIN_URL "http://127.0.0.1:${CHAIN_PORT}"

  # Контроллер живёт в docker-сети и зовёт соседей по именам сервисов.
  local ctl_env=components/controller/.env
  cp components/controller/.env-example "$ctl_env"
  set_env "$ctl_env" BACKEND_URL "http://127.0.0.1:${API_PORT}"
  set_env "$ctl_env" MONGODB_URL "mongodb://mongo:27017/cooperative-x"
  set_env "$ctl_env" BLOCKCHAIN_RPC "http://node:8888"
  set_env "$ctl_env" REDIS_HOST monoredis
  set_env "$ctl_env" POSTGRES_HOST postgres
  set_env "$ctl_env" POSTGRES_PORT 5432
  set_env "$ctl_env" POSTGRES_USERNAME postgres
  set_env "$ctl_env" POSTGRES_PASSWORD "$PG_PASSWORD"
  set_env "$ctl_env" POSTGRES_DATABASE voskhod
  set_env "$ctl_env" MINIO_ENDPOINT "http://minio:9000"
  set_env "$ctl_env" SMTP_HOST mailpit
  set_env "$ctl_env" SMTP_PORT 1025
  # Ключи веб-уведомлений обязательны для конфига; одноразовая пара, как в test.yaml.
  local vapid
  vapid="$(cd components/controller && node -e "const k=require('web-push').generateVAPIDKeys(); console.log(k.publicKey + ' ' + k.privateKey)")"
  set_env "$ctl_env" VAPID_PUBLIC_KEY "${vapid%% *}"
  set_env "$ctl_env" VAPID_PRIVATE_KEY "${vapid##* }"

  # Секреты CoopID: генератор кладёт их с правами 0400 от пользователя раннера,
  # а postgres, authentik и контроллер читают их из контейнеров под своими uid.
  # Машина одноразовая, поэтому просто открываем чтение.
  bash scripts/coopid-gen-secrets.sh
  chmod a+r infra/coopid/secrets/*
  bash components/boot/scripts/sync-authentik-bootstrap.sh
}

cmd_image() {
  load_stack
  docker compose build coopback
}

cmd_infra() {
  load_stack
  stack_up_infra
  stack_up_authentik
  stack_migrate_schema
}

cmd_boot() {
  load_stack
  (cd components/boot && pnpm run boot:extra)
  local id
  id="$(chain_id)"
  echo "chain_id=$id"
  set_env components/controller/.env CHAIN_ID "$id"
}

# Автоматическая регистрация долей держателей Благороста выключена, пока идут
# boot-тесты контракта: они шлют действия прямо в цепь и считают премии
# вкладчиков точно, а доли, заведённые контроллером параллельно, делали итог
# зависимым от гонки. Перед API-тестами автоматика включается обратно
# (controller_autoreg_on) — там её проверяют (решение владельца 25.09.2026).
AUTOREG_KEY=CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION

cmd_app() {
  load_stack
  set_env components/controller/.env "$AUTOREG_KEY" off
  docker compose up -d mailpit
  docker compose up -d parser2
  docker compose up -d coopback

  echo "▸ Ждём API контроллера..."
  if ! stack_wait_for "API контроллера" 300 3 api_ready; then
    docker compose logs --tail 200 coopback
    exit 1
  fi

  # Таблицу ПВЗ создают миграции расширения; без засева сценарии Стола заказов
  # падают на пустом селекте (см. extra_reboot.sh).
  if stack_wait_for "таблица ПВЗ" 120 2 \
    bash -c 'docker compose exec -T postgres psql -U postgres -d voskhod -tAc "SELECT to_regclass('"'"'public.marketplace_ku_details'"'"')" | grep -q marketplace_ku_details'
  then
    (cd components/boot && pnpm run seed:marketplace-ku) || echo "  ⚠ сид ПВЗ не выполнен"
  fi
  stack_summary
}

# Засев Стола заказов (участники-фикстуры docs-harness и фазы seed-marketplace):
# без него наборы маркетплейса не находят своих пайщиков и не запускаются.
cmd_seed() {
  load_stack
  node scripts/blackbox/seed.mjs
}

cmd_tests() {
  load_stack
  CHAIN_ID="$(chain_id)"
  export CHAIN_ID
  export API_URL="http://127.0.0.1:${API_PORT}/v1/graphql"
  export CHAIN_URL="http://127.0.0.1:${CHAIN_PORT}"
  export SERVER_SECRET="${SERVER_SECRET:-SECRET}"
  export TEST_EMAIL="${TEST_EMAIL:-ivanov@example.com}"
  cd components/boot
  # Файлы идут строго по очереди (vitest.config.ts): все пишут в одну цепь.
  pnpm exec vitest run \
    --reporter=default --reporter=junit \
    --outputFile.junit="$OUT/junit.xml" \
    ${BLACKBOX_TESTS:-}
}

# Каркас внешнего слоя components/api-tests: те же адреса, свой отчёт JUnit.
# Матрица прав (src/rights) идёт отдельной фазой после всех сценариев — она
# зовёт мутации от лица каждой роли с чужими аргументами.
api_tests_env() {
  load_stack
  CHAIN_ID="$(chain_id)"
  export CHAIN_ID
  export API_URL="http://127.0.0.1:${API_PORT}/v1/graphql"
  export CHAIN_URL="http://127.0.0.1:${CHAIN_PORT}"
}

# Контроллер с включённой автоматикой: пересоздаётся, только если стенд
# поднимался с выключенной (повторный запуск фазы ничего не перезапускает).
controller_autoreg_on() {
  load_stack
  grep -q "^${AUTOREG_KEY}=off$" components/controller/.env || return 0
  set_env components/controller/.env "$AUTOREG_KEY" on
  echo "▸ Включаем автоматическую регистрацию долей — пересоздаём контроллер..."
  docker compose up -d --no-deps --force-recreate coopback
  if ! stack_wait_for "API контроллера" 300 3 api_ready; then
    docker compose logs --tail 200 coopback
    exit 1
  fi
}

cmd_apitests() {
  ( controller_autoreg_on )
  api_tests_env
  cd components/api-tests
  pnpm exec vitest run \
    --reporter=default --reporter=junit \
    --outputFile.junit="$OUT/junit-api.xml" \
    --exclude 'src/rights/**' \
    ${BLACKBOX_API_TESTS:-}
}

cmd_rights() {
  api_tests_env
  export RIGHTS_OUT="$OUT/rights"
  mkdir -p "$RIGHTS_OUT"
  cd components/api-tests
  pnpm exec vitest run src/rights \
    --reporter=default --reporter=junit \
    --outputFile.junit="$OUT/junit-rights.xml"
}

# Журнал запросов к базе (pg_stat_statements, включён надстройкой компоуза).
#   dbcov start       — завести расширение, выписать таблицы, обнулить журнал;
#   dbcov snap <фаза> — сохранить журнал фазы в $OUT/dbcov/<фаза>.json и обнулить.
# Разбор — scripts/blackbox/db-coverage.mjs (сводка покрытия таблиц).
DBCOV_DBS_SQL="SELECT datname FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres','authentik_db')"

pg() { docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -tAq "$@"; }

cmd_dbcov() {
  load_stack
  mkdir -p "$OUT/dbcov"
  case "${1:-}" in
    start)
      pg -d voskhod -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements'
      local db first=1
      {
        echo '['
        for db in $(pg -d voskhod -c "$DBCOV_DBS_SQL"); do
          [ $first = 1 ] || echo ','
          first=0
          pg -d "$db" -c "SELECT coalesce(json_agg(json_build_object('db', current_database(), 'table', tablename)), '[]') FROM pg_tables WHERE schemaname = 'public'"
        done
        echo ']'
      } > "$OUT/dbcov/tables.json"
      pg -d voskhod -c 'SELECT pg_stat_statements_reset()' >/dev/null
      ;;
    snap)
      local phase="${2:?фаза}"
      pg -d voskhod -c "SELECT coalesce(json_agg(json_build_object('db', d.datname, 'query', s.query, 'calls', s.calls, 'rows', s.rows)), '[]')
        FROM pg_stat_statements s JOIN pg_database d ON d.oid = s.dbid
        WHERE d.datname IN ($DBCOV_DBS_SQL)" > "$OUT/dbcov/$phase.json"
      pg -d voskhod -c 'SELECT pg_stat_statements_reset()' >/dev/null
      ;;
    *) echo "dbcov: start | snap <фаза>" >&2; exit 2 ;;
  esac
}

cmd_collect() {
  load_stack
  mkdir -p "$OUT/logs"
  docker compose ps -a > "$OUT/logs/ps.txt" 2>&1 || true
  local svc
  for svc in node parser2 coopback postgres mongo monoredis minio mailpit authentik-server authentik-worker; do
    docker compose logs --no-color --timestamps "$svc" > "$OUT/logs/$svc.log" 2>&1 || true
  done
  docker stats --no-stream > "$OUT/logs/stats.txt" 2>&1 || true
}

# Сводка в Job Summary: время фаз из API GitHub и итог тестов из JUnit.
cmd_summary() {
  local summary="${GITHUB_STEP_SUMMARY:-$OUT/summary.md}"
  {
    if [ "${SEED_OUTCOME:-}" = "failure" ]; then
      echo "> ⚠️ **Засев Стола заказов упал.** Шаг помечен зелёным (continue-on-error),"
      echo "> но наборы маркетплейса шли на неполном стенде — их падения сначала смотреть"
      echo "> в логе шага «Стенд — засев Стола заказов»."
      echo
    fi
    echo "## Black-box: время фаз"
    echo
    if [ -n "${GITHUB_RUN_ID:-}" ] && command -v gh >/dev/null; then
      gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT:-1}/jobs" \
        --jq '.jobs[0].steps[] | select(.started_at and .completed_at) | [.name, .conclusion, .started_at, .completed_at] | @tsv' \
        | python3 -c '
import sys, datetime as d
p = lambda s: d.datetime.fromisoformat(s.replace("Z", "+00:00"))
print("| фаза | итог | время |")
print("|---|---|---|")
for line in sys.stdin:
    name, concl, a, b = line.rstrip("\n").split("\t")
    s = int((p(b) - p(a)).total_seconds())
    print(f"| {name} | {concl} | {s // 60} мин {s % 60} с |")
' || echo "_время фаз недоступно_"
    fi
    echo
    echo "## Black-box: тесты"
    echo
    local junit found=0
    for junit in "$OUT/junit.xml" "$OUT/junit-api.xml" "$OUT/junit-rights.xml"; do
      # Пустой отчёт — набор не нашёл файлов или упал до старта.
      [ -s "$junit" ] || continue
      found=1
      python3 - "$junit" <<'PY'
import os, sys, xml.etree.ElementTree as ET
titles = {"junit.xml": "boot (components/boot/src/tests)", "junit-api.xml": "api-tests (components/api-tests)", "junit-rights.xml": "матрица прав"}
root = ET.parse(sys.argv[1]).getroot()
suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
total = failed = skipped = 0
fails = []
for s in suites:
    for c in s.iter("testcase"):
        total += 1
        if c.find("skipped") is not None:
            skipped += 1
        elif c.find("failure") is not None or c.find("error") is not None:
            failed += 1
            fails.append(f"{c.get('classname')} › {c.get('name')}")
print(f"**{titles.get(os.path.basename(sys.argv[1]), sys.argv[1])}:** всего {total}, прошло {total - failed - skipped}, упало {failed}, пропущено {skipped}.")
if fails:
    print()
    for f in fails[:60]:
        print(f"- {f}")
print()
PY
    [ $? -eq 0 ] || echo "_отчёт $(basename "$junit") не разобран_"
    done
    [ $found = 1 ] || echo "_отчётов JUnit нет — до тестов прогон не дошёл_"
    echo
    if [ -f "$OUT/rights/summary.md" ]; then
      cat "$OUT/rights/summary.md"
      echo
    fi
    if [ -d "$OUT/dbcov" ]; then
      node scripts/blackbox/db-coverage.mjs "$OUT" || echo "_разбор журнала запросов упал_"
    fi
  } >> "$summary"
}

case "${1:-}" in
  env) cmd_env ;;
  image) cmd_image ;;
  infra) cmd_infra ;;
  boot) cmd_boot ;;
  app) cmd_app ;;
  seed) cmd_seed ;;
  tests) cmd_tests ;;
  apitests) cmd_apitests ;;
  rights) cmd_rights ;;
  dbcov) shift; cmd_dbcov "$@" ;;
  collect) cmd_collect ;;
  summary) cmd_summary ;;
  *) echo "использование: $0 <env|image|infra|boot|app|seed|tests|apitests|rights|dbcov|collect|summary>" >&2; exit 2 ;;
esac
