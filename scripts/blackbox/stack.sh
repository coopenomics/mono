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
# Использование: scripts/blackbox/stack.sh <env|image|infra|boot|app|tests|collect|summary>

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

cmd_app() {
  load_stack
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

cmd_collect() {
  load_stack
  mkdir -p "$OUT/logs"
  docker compose ps -a > "$OUT/logs/ps.txt" 2>&1 || true
  local svc
  for svc in node parser2 coopback postgres mongo monoredis minio authentik-server authentik-worker; do
    docker compose logs --no-color --timestamps "$svc" > "$OUT/logs/$svc.log" 2>&1 || true
  done
  docker stats --no-stream > "$OUT/logs/stats.txt" 2>&1 || true
}

# Сводка в Job Summary: время фаз из API GitHub и итог тестов из JUnit.
cmd_summary() {
  local summary="${GITHUB_STEP_SUMMARY:-$OUT/summary.md}"
  {
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
    if [ -f "$OUT/junit.xml" ]; then
      python3 - "$OUT/junit.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
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
print(f"Всего {total}, прошло {total - failed - skipped}, упало {failed}, пропущено {skipped}.")
if fails:
    print()
    for f in fails[:60]:
        print(f"- {f}")
PY
    else
      echo "_junit.xml нет — до тестов прогон не дошёл_"
    fi
  } >> "$summary"
}

case "${1:-}" in
  env) cmd_env ;;
  image) cmd_image ;;
  infra) cmd_infra ;;
  boot) cmd_boot ;;
  app) cmd_app ;;
  tests) cmd_tests ;;
  collect) cmd_collect ;;
  summary) cmd_summary ;;
  *) echo "использование: $0 <env|image|infra|boot|app|tests|collect|summary>" >&2; exit 2 ;;
esac
