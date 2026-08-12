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

# Останавливаем и удаляем контейнеры вместе с volumes
echo "Останавливаем и удаляем контейнеры с volumes..."
docker compose down -v mongo postgres monoredis cooparser parser2 coopback || true

# Останавливаем blockchain контейнер перед удалением данных
echo "Останавливаем blockchain контейнер..."
docker compose stop node || true

# Удаляем blockchain data
echo "Удаляем blockchain data..."
# sudo chmod -R 755 ../blockchain-data/ 2>/dev/null || true
docker run --rm -v "$(cd .. && pwd)/blockchain-data:/d" alpine sh -c 'rm -rf /d/* /d/.[!.]* 2>/dev/null || true'

# Пересоздаем и запускаем базы данных + MinIO (file-storage).
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

# Запускаем boot процесс
echo "Запускаем boot процесс..."
pnpm run boot

# Запускаем parser
echo "Запускаем parser..."
docker compose up -d cooparser

# Индексер parser2 — источник событий для контроллера. Поднимаем его ДО
# контроллера: тот читает только стрим parser2, и без индексера синхронизация
# с цепью просто стоит, а состояние в базе остаётся тем, что записали прямые
# вызовы API. Стрим пуст после down -v (redis-том удалён), поэтому индексер
# перечитывает цепь с первого блока.
echo "Запускаем индексер parser2..."
docker compose up -d parser2

echo "Запускаем контроллер..."
docker compose up -d --force-recreate coopback || true

echo "Перезапуск завершен!"
