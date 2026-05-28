#!/bin/bash

# Загружаем per-instance конфиг из корня репо.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

# Останавливаем контроллер перед очисткой данных
echo "Останавливаем контроллер..."
docker compose down coopback || true

# Останавливаем и удаляем контейнеры вместе с volumes
echo "Останавливаем и удаляем контейнеры с volumes..."
docker compose down -v mongo postgres cooparser || true

# Останавливаем blockchain контейнер перед удалением данных
echo "Останавливаем blockchain контейнер..."
docker compose stop node || true

# Удаляем blockchain data
echo "Удаляем blockchain data..."
# sudo chmod -R 755 ../blockchain-data/ 2>/dev/null || true
sudo rm -rf ../blockchain-data/

# Пересоздаем и запускаем базы данных
echo "Пересоздаем и запускаем базы данных..."
docker compose up -d mongo postgres

# Ждем готовности MongoDB
echo "Ждем готовности MongoDB..."
until docker compose exec -T mongo mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
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

# Запускаем boot процесс
echo "Запускаем boot процесс..."
pnpm run boot:extra

# Запускаем parser
echo "Запускаем parser..."
docker compose up -d cooparser

echo "Запускаем контроллер..."
docker compose up -d coopback

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
