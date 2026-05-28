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

# Останавливаем и удаляем контейнеры (сеть НЕ трогаем — к ней может быть
# подключён внешний контейнер вроде provider-backend; down её снёс бы с ошибкой).
echo "Останавливаем и удаляем контейнеры..."
docker compose rm -fsv mongo postgres monoredis cooparser coopback || true

# Останавливаем blockchain контейнер перед удалением данных
echo "Останавливаем blockchain контейнер..."
docker compose stop node || true

# Удаляем тома баз данных для чистого старта (named volumes rm -v не чистит)
echo "Удаляем тома баз данных..."
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}"
docker volume rm "${PROJECT}_postgres_data" "${PROJECT}_mongo_data" 2>/dev/null || true

# Удаляем blockchain data через контейнер (alpine под root стирает данные
# независимо от владельца — без sudo на любой ноде; на проде nodeos пишет под root).
echo "Удаляем blockchain data..."
docker run --rm -v "$(cd .. && pwd)/blockchain-data:/d" alpine sh -c 'rm -rf /d/* /d/.[!.]* 2>/dev/null || true'

# Пересоздаем и запускаем базы данных + Redis (monoredis).
# monoredis ОБЯЗАТЕЛЕН: без него coopback падает на старте с
# `getaddrinfo EAI_AGAIN monoredis` → MaxRetriesPerRequestError → nodemon crash.
echo "Пересоздаем и запускаем базы данных..."
docker compose up -d mongo postgres monoredis

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

# Запускаем boot процесс (clean: только программы Благорост/маркетплейс)
echo "Запускаем boot процесс..."
pnpm run boot:clean

# Запускаем parser
echo "Запускаем parser..."
docker compose up -d cooparser

echo "Запускаем контроллер..."
docker compose up -d --force-recreate coopback || true

echo "Перезапуск завершен!"
