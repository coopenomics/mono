#!/bin/bash

# Загружаем per-instance конфиг из корня репо (для CHAIN_URL/MONGODB_URL/API_URL,
# которые читают TS-код boot и шелл-скрипты networks.sh/preactivate.sh).
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

# Останавливаем и удаляем контейнеры вместе с volumes.
#
# Именно `rm -svf` по списку, а не `docker compose down -v`: подкоманда `down`
# список сервисов не принимает и сносит ВСЕ контейнеры проекта — вместе с
# фронтом. Фронт при этом теряется дважды: reboot его обратно не поднимал
# (прогон падал на преflight'е «desktop не отвечает» уже после успешного
# reboot), а поднятый заново `quasar dev` компилирует маршруты с нуля — кэш
# трансформаций живёт в памяти процесса, на диск не ложится. Холодный фронт
# не успевает отдать страницу за таймауты сценариев, и прогон разваливается
# на середине цепочки. Фронт данных не хранит, чистить его незачем.
#
# `rm -v` снимает только анонимные тома, поэтому именованные удаляем явно —
# иначе БД и цепь переживут «перезапуск с чистого листа».
echo "Останавливаем и удаляем контейнеры с volumes..."
docker compose rm -svf mongo postgres monoredis minio cooparser coopback || true
for vol in postgres_data mongo_data minio_data; do
  docker volume rm -f "${COMPOSE_PROJECT_NAME:-mono-ai-4}_${vol}" >/dev/null 2>&1 || true
done

# Останавливаем blockchain контейнер перед удалением данных
echo "Останавливаем blockchain контейнер..."
docker compose stop node || true

# Удаляем blockchain data.
# Контейнерный wipe (alpine под root) стирает данные независимо от их владельца —
# без sudo на любой ноде (на Pi нет passwordless sudo; на проде nodeos пишет
# данные под root). Единый способ с reboot.sh / clean_reboot.sh.
echo "Удаляем blockchain data..."
# sudo chmod -R 755 ../blockchain-data/ 2>/dev/null || true
docker run --rm -v "$(cd .. && pwd)/blockchain-data:/d" alpine sh -c 'rm -rf /d/* /d/.[!.]* 2>/dev/null || true'

# Пересоздаем и запускаем базы данных + Redis (monoredis).
# monoredis ОБЯЗАТЕЛЕН: без него coopback падает на старте с
# `getaddrinfo EAI_AGAIN monoredis` → MaxRetriesPerRequestError → nodemon crash,
# и провайдер не может взять org-данные partner1 (PROVIDER_URL=coopback:2998).
echo "Пересоздаем и запускаем базы данных..."
docker compose up -d mongo postgres monoredis minio

# Ждем готовности MongoDB (standalone, ping вместо ожидания PRIMARY).
echo "Ждем готовности MongoDB..."
until docker compose exec -T mongo mongosh --quiet --eval "db.adminCommand({ping:1}).ok" > /dev/null 2>&1; do
  echo "MongoDB еще не готов, ждем..."
  sleep 2
done
echo "MongoDB готов!"

# Ждем готовности PostgreSQL
echo "Ждем готовности PostgreSQL..."
until docker compose exec -T postgres pg_isready -U postgres -d voskhod > /dev/null 2>&1; do
  echo "PostgreSQL еще не готов, ждем..."
  sleep 2
done
echo "PostgreSQL готов!"

# Ждем готовности MinIO
echo "Ждем готовности MinIO..."
until docker compose exec -T minio curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  echo "MinIO еще не готов, ждем..."
  sleep 2
done
echo "MinIO готов!"

# Запускаем boot процесс (расширенный: совет + пайщики; partner1 — при EXTRA_RENT=1)
echo "Запускаем boot процесс..."
pnpm run boot:extra

# Запускаем parser
echo "Запускаем parser..."
docker compose up -d cooparser

echo "Запускаем контроллер..."
docker compose up -d --force-recreate coopback || true

# `docker compose down` выше сносит ВСЕ контейнеры проекта, а не только
# перечисленные (список сервисов эта подкоманда не принимает) — вместе с
# фронтом. Сам он обратно не поднимается, и прогон падает на преflight'е
# «desktop не отвечает» уже после успешного reboot'а, то есть --reboot
# оказывается неработоспособным. Поднимаем обратно, но только если порт
# свободен: фронт могли запустить с хоста через `quasar dev`, и тогда
# контейнер лишь отобрал бы у него порт.
if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${DESKTOP_HOST_PORT:-2999}"; then
  echo "Фронт уже отвечает на ${DESKTOP_HOST_PORT:-2999} — оставляем как есть"
else
  echo "Запускаем фронт..."
  docker compose up -d desktop || true
fi

# Контроллер создаёт marketplace-таблицы через TypeORM synchronize при старте.
# Ждём появления marketplace_ku_details, затем засеваем 3 ПВЗ Подмосковья
# (krg/odn/myt, ACTIVE) — иначе на свежем стенде таблица пуста, select ПВЗ
# приходит пустым/disabled и harness-сценарии ломаются. Сидер идемпотентен.
echo "Ждём создания marketplace_ku_details контроллером..."
KU_READY=""
for _ in $(seq 1 60); do
  if docker compose exec -T postgres psql -U "${POSTGRES_USERNAME:-postgres}" -d "${POSTGRES_DATABASE:-voskhod}" -tAc "SELECT to_regclass('public.marketplace_ku_details')" 2>/dev/null | grep -q marketplace_ku_details; then
    KU_READY=1
    break
  fi
  sleep 2
done
if [ -n "$KU_READY" ]; then
  echo "Засеваем 3 ПВЗ Подмосковья (krg/odn/myt)..."
  pnpm run seed:marketplace-ku || echo "⚠ seed ПВЗ не выполнен (не критично для остального стенда)"
else
  echo "⚠ marketplace_ku_details не появилась за отведённое время — пропускаем seed ПВЗ"
fi

echo "Перезапуск завершен!"
