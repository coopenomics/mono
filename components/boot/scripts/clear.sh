#!/bin/bash

# Загружаем per-instance конфиг из корня репо.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

# Останавливаем и удаляем контейнеры вместе с volumes
echo "Останавливаем и удаляем контейнеры с volumes..."
docker compose down -v mongo postgres parser2 || true

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
