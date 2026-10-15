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

# ── Подъём ───────────────────────────────────────────────────────────────────

stack_up_infra() {
  # Секреты CoopID лежат вне git (infra/coopid/secrets в .gitignore), а компоуз
  # монтирует их bind-mount'ом: на стенде, где их ни разу не генерировали, подъём
  # падает ещё на создании контейнеров — «bind source path does not exist». Гоняем
  # генератор перед каждым подъёмом: он идемпотентен и существующие файлы не трогает.
  bash "$STACK_ROOT/scripts/coopid-gen-secrets.sh" || true

  echo "▸ Поднимаем базы и файловое хранилище..."
  docker compose up -d $STACK_INFRA_SERVICES
  stack_wait_infra
  stack_check_coopid_databases || true
}

# Схема базы — миграциями контроллера, до boot (C28-79): boot засевает
# пользователей, ключи и расширения в уже созданные таблицы, а сам их больше не
# заводит. С хоста база видна по адресу из окружения стенда (корневой .env у
# mono-ai-2..5) либо из components/boot/.env; в .env контроллера — имя сервиса
# внутри docker-сети, с хоста оно не резолвится.
# Запустить команду со спиннером и секундомером, пока она молчит. Вывод команды
# печатается по мере появления строк; код возврата — её собственный. Вне
# терминала (CI, лог в файл) спиннера нет — только вывод команды.
stack_spin() {
  local label="$1"; shift
  local log; log="$(mktemp)"
  "$@" >"$log" 2>&1 &
  local pid=$! start=$SECONDS shown=0 frame=0 lines rc
  local frames='|/-\' tty=0
  [ -t 1 ] && tty=1
  while kill -0 "$pid" 2>/dev/null; do
    lines=$(wc -l <"$log")
    if [ "$lines" -gt "$shown" ]; then
      [ "$tty" = 1 ] && printf '\r\033[K'
      sed -n "$((shown + 1)),${lines}p" "$log"
      shown=$lines
    elif [ "$tty" = 1 ]; then
      printf '\r  %s %s — %d с' "${frames:frame++ % 4:1}" "$label" $((SECONDS - start))
    fi
    sleep 0.2
  done
  wait "$pid"; rc=$?
  [ "$tty" = 1 ] && printf '\r\033[K'
  sed -n "$((shown + 1)),\$p" "$log"
  rm -f "$log"
  return "$rc"
}

stack_migrate_schema() {
  echo "▸ Накатываем миграции схемы базы..."
  local boot_env="$STACK_ROOT/components/boot/.env" host="" port=""
  if [ -f "$boot_env" ]; then
    host="$(grep -E '^POSTGRES_HOST=' "$boot_env" | tail -1 | cut -d= -f2-)"
    port="$(grep -E '^POSTGRES_PORT=' "$boot_env" | tail -1 | cut -d= -f2-)"
  fi
  # ts-node сначала компилирует граф контроллера с проверкой типов — это
  # минута-две без единой строки вывода; спиннер показывает, что шаг живой.
  if ! (cd "$STACK_ROOT" && \
    POSTGRES_HOST="${POSTGRES_HOST:-${host:-127.0.0.1}}" \
    POSTGRES_PORT="${POSTGRES_PORT:-${port:-5432}}" \
    stack_spin "компиляция контроллера и накат схемы" \
      pnpm -F @coopenomics/controller run schema:migrate); then
    echo "✗ Миграции схемы не прошли — boot не запускаем"
    return 1
  fi
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
  # Готовности не ждём. Authentik на чистом томе прогоняет собственные миграции
  # и здоровым становится через минуты, а в скрипте от него не зависит ничего:
  # boot разговаривает с цепью, контроллеру он нужен уже в работе. Ожидание
  # здесь только держало человека у экрана — ровно то, ради чего убраны
  # ожидания контроллера и рабочего стола.
  echo "  authentik прогревается в фоне"
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
