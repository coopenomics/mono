# File-storage integration tests

Тесты против реального MinIO. По умолчанию ожидают MinIO на `http://localhost:9100` с
кредами `testuser` / `testpassword` (см. `docker-compose.yml` рядом).

## Как запустить

```bash
# 1. Поднять MinIO
docker compose -f components/controller/tests/file-storage/docker-compose.yml up -d
# дождаться healthy

# 2. Запустить интеграционные тесты
cd components/controller
npm run test:integration:file-storage

# 3. После работы
docker compose -f components/controller/tests/file-storage/docker-compose.yml down -v
```

## Переопределение через env

| Переменная | Default | Что делает |
|---|---|---|
| `FILE_STORAGE_TEST_MINIO_ENDPOINT` | `http://localhost:9100` | URL MinIO |
| `FILE_STORAGE_TEST_MINIO_ACCESS_KEY` | `testuser` | Access key |
| `FILE_STORAGE_TEST_MINIO_SECRET_KEY` | `testpassword` | Secret key |
| `FILE_STORAGE_TEST_BUCKET` | `coop-test-{timestamp}` | Имя физического бакета (уникально per-run) |

Если MinIO недоступен на `endpoint`, suite пропускает тесты (`it.skip`) с диагностическим сообщением.
