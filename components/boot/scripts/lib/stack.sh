#!/usr/bin/env bash
# Общие шаги подъёма dev-стенда. Подключается через `source`, сам ничего не делает.
#
# Зачем библиотека: reboot / clean_reboot / extra_reboot / blago_reboot были
# четырьмя почти дословными копиями. Любая правка (появился authentik, появился
# единый вход nginx) требовала четырёх одинаковых правок, и на практике доезжала
# в одну. Теперь шаги живут здесь, а скрипты отличаются только тем, чем должны:
# какой boot запускают и что досевают после.
#
# Инвариант: стенд поднимается ЦЕЛИКОМ одной командой. Руками ничего доподнимать
# не надо — если сервис появился в компоузе, он должен появиться и здесь.

# Все сервисы прикладного слоя. Порядок важен: nginx последним, он лишь
# раскладывает запросы по уже поднятым.
STACK_INFRA_SERVICES="mongo postgres monoredis minio"
STACK_AUTH_SERVICES="authentik-server authentik-worker"
STACK_APP_SERVICES="parser2 coopback desktop nginx"

# ── Окружение ────────────────────────────────────────────────────────────────

stack_load_env() {
  # Четыре уровня вверх: lib → scripts → boot → components → корень репозитория.
  # (Скрипты рядом отсчитывают три — они лежат на уровень выше этого файла.)
  STACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
  export STACK_ROOT
  if [ -f "$STACK_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$STACK_ROOT/.env"
    set +a
  fi
  STACK_PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$STACK_ROOT")}"
  export STACK_PROJECT
}

# ── Очистка ──────────────────────────────────────────────────────────────────

# Контейнеры сносим через `rm -fsv`, а НЕ через `down`: down убирает ещё и сеть
# компоуза, а к ней может быть подключён внешний контейнер (например
# provider-backend) — тогда команда падает, а стенд остаётся полуразобранным.
stack_wipe_containers() {
  echo "▸ Останавливаем и удаляем контейнеры стенда..."
  docker compose rm -fsv $STACK_INFRA_SERVICES $STACK_AUTH_SERVICES $STACK_APP_SERVICES || true
  docker compose stop node || true
}

# Именованные тома `rm -v` не трогает — только анонимные. Удаляем поимённо,
# иначе на «чистом» ребуте останутся старая база и старая учётка authentik.
stack_wipe_volumes() {
  echo "▸ Удаляем тома баз данных..."
  docker volume rm \
    "${STACK_PROJECT}_postgres_data" \
    "${STACK_PROJECT}_mongo_data" \
    "${STACK_PROJECT}_minio_data" 2>/dev/null || true
}

# Данные цепи стираем контейнером под root: nodeos пишет их от root, и на узле
# без passwordless sudo обычный rm не справится.
stack_wipe_chain() {
  echo "▸ Удаляем данные цепи..."
  docker run --rm -v "$STACK_ROOT/components/boot/blockchain-data:/d" alpine \
    sh -c 'rm -rf /d/* /d/.[!.]* 2>/dev/null || true'
}

stack_wipe_all() {
  stack_wipe_containers
  stack_wipe_volumes
  stack_wipe_chain
}

# ── Ожидания готовности ──────────────────────────────────────────────────────

# Общий поллер: имя, число попыток, пауза, команда-проверка.
stack_wait_for() {
  local label="$1" tries="$2" pause="$3"
  shift 3
  local i
  for i in $(seq 1 "$tries"); do
    if "$@" >/dev/null 2>&1; then
      echo "  ✅ $label готов"
      return 0
    fi
    sleep "$pause"
  done
  echo "  ⚠ $label не поднялся за $((tries * pause)) с"
  return 1
}

stack_wait_infra() {
  stack_wait_for "MongoDB" 60 2 \
    docker compose exec -T mongo mongosh --quiet --eval "db.adminCommand({ping:1}).ok"
  stack_wait_for "PostgreSQL" 60 2 \
    docker compose exec -T postgres pg_isready -U "${POSTGRES_USERNAME:-postgres}" -d "${POSTGRES_DATABASE:-voskhod}"
  stack_wait_for "MinIO" 60 2 \
    docker compose exec -T minio curl -sf http://localhost:9000/minio/health/live
}

# Базы CoopID заводит init-скрипт postgres, и только на ПУСТОМ томе. Если том
# пережил ребут, а базы в нём нет — authentik не стартует, и без этой проверки
# причина выясняется долго и неприятно.
stack_coopid_database_exists() {
  docker compose exec -T postgres psql -U "${POSTGRES_USERNAME:-postgres}" -lqt 2>/dev/null \
    | cut -d'|' -f1 | grep -qw "$1"
}

stack_check_coopid_databases() {
  local missing=""
  local db
  # Ждём каждую базу, а не проверяем разом сразу после pg_isready: готовность
  # сервера наступает раньше, чем отрабатывает init-скрипт (он выполняется на
  # временном сервере, доступном через сокет), и проверка успевает увидеть
  # полусозданный набор баз. Тревога тогда ложная — база появляется секундой
  # позже. Ждём минуту, и только потом считаем базу отсутствующей.
  for db in authentik_db coop_domain_db; do
    stack_wait_for "база $db" 30 2 stack_coopid_database_exists "$db" >/dev/null 2>&1 \
      || missing="$missing $db"
  done
  if [ -n "$missing" ]; then
    echo "  ⚠ в postgres нет баз CoopID:$missing"
    echo "    Их создаёт infra/coopid/postgres/init/01-init.sh, а он отрабатывает"
    echo "    только на пустом томе. Снеси том postgres и повтори ребут."
    return 1
  fi
  echo "  ✅ базы CoopID на месте"
}

stack_wait_authentik() {
  stack_wait_for "authentik" 90 2 \
    docker compose exec -T authentik-server curl -sf http://localhost:9000/-/health/ready/
}



# ── Подъём ───────────────────────────────────────────────────────────────────

stack_up_infra() {
  echo "▸ Поднимаем базы и файловое хранилище..."
  docker compose up -d $STACK_INFRA_SERVICES
  stack_wait_infra
  stack_check_coopid_databases || true
}

stack_up_authentik() {
  # Bootstrap-значения authentik читаются им НАПРЯМУЮ из окружения и префикс file://
  # не понимают — их надо положить в .env реальными значениями. Иначе админ-токеном
  # становится сама строка `file:///run/secrets/...`, контроллер получает 403, а
  # миграция «ключ→пароль» падает с 500. Синхронизируем перед каждым подъёмом:
  # применяются они только при первой инициализации базы authentik, а её чистый
  # ребут как раз и пересоздаёт.
  bash "$(dirname "${BASH_SOURCE[0]}")/../sync-authentik-bootstrap.sh" || true

  echo "▸ Поднимаем authentik..."
  docker compose up -d $STACK_AUTH_SERVICES
  stack_wait_authentik || true
}

stack_up_app() {
  echo "▸ Поднимаем индексер, бэкенд, рабочий стол и единый вход..."
  # Индексер parser2 — источник событий для контроллера, поднимается ДО него:
  # coopback читает только стрим parser2, без индексера синхронизация с цепью
  # просто стоит. Стрим пуст после чистого ребута — индексер перечитывает цепь
  # с первого блока.
  docker compose up -d parser2
  docker compose up -d --force-recreate coopback || true
  # Фронт могли запустить с хоста через `quasar dev` — тогда контейнер лишь
  # отобрал бы у него порт. Поднимаем контейнер, только если порт молчит.
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${DESKTOP_HOST_PORT:-2999}"; then
    echo "  фронт уже отвечает на ${DESKTOP_HOST_PORT:-2999} — оставляем как есть"
  else
    docker compose up -d desktop
  fi
  docker compose up -d nginx
  # Контроллер и рабочий стол дальше прогреваются сами, и скрипт их не караулит.
  # Оба поднимаются через компиляцию (ts-node типизирует проект, quasar собирает
  # маршруты) и на занятой машине занимают минуты — караулить их значило держать
  # человека у экрана ради строчки «готов». Свои миграции контроллер теперь
  # накатывает сам при старте (AUTO_MIGRATE в компоузе), отдельный заход по
  # живому контейнеру не нужен.
  echo "  контроллер и рабочий стол прогреваются в фоне"
  echo "    смотреть: docker compose logs -f coopback"
}


# ── Итог ─────────────────────────────────────────────────────────────────────

stack_summary() {
  local port="${NGINX_HOST_PORT:-8108}"
  echo
  echo "── Состояние стенда ─────────────────────────────────────────────"
  docker compose ps --format "  {{.Service}}\t{{.Status}}" 2>/dev/null || docker compose ps
  echo
  echo "  Единый вход:  http://localhost:${port}"
  echo "    рабочий стол   /"
  echo "    бэкенд         /backend"
  echo "    блокчейн       /api"
  echo "    authentik      /if/  и  /application/o/"
  echo "  Проброс к себе:  ssh -L ${port}:127.0.0.1:${port} <этот-сервер>"
  echo "─────────────────────────────────────────────────────────────────"
}
