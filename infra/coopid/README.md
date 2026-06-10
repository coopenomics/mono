# CoopID — инфраструктура per-coop (Story 1.1)

Стек OIDC-аутентификации кооператива встроен в **основной** `docker-compose.yaml`
монорепы: authentik 2026.2 (server + worker), caddy (внешний TLS 1.3) и crowdsec.
Отдельный postgres не поднимается — данные authentik и доменные данные CoopID
живут **двумя отдельными БД в существующем сервисе `postgres`**:

- `authentik_db` — роль `authentik_user` (данные authentik);
- `coop_domain_db` — роль `coop_app_user` (vaults, audit, кэши — миграции V2.4.x).

Ролевая изоляция: подключиться к чужой БД может только её владелец (и суперюзер).
Redis — общий `monoredis` (authentik в DB-индексе 1, controller в 0).

Весь стек поднимается **одной командой** — никаких overlay `-f`-цепочек.

> ⚠️ **ОБЯЗАТЕЛЬНО перед первым `docker compose up -d` (и на каждом чекауте/ноде).**
> CoopID-сервисы в `docker-compose.yaml` ссылаются на file-секреты из
> `infra/coopid/secrets/*` (каталог в `.gitignore` — в репозиторий не попадает).
> Если этих файлов нет, `docker compose up -d` **падает на этапе валидации
> конфига** (`secret ... not found`) и не поднимает вообще ничего, включая
> базовый стек. Лекарство — один раз прогнать:
>
> ```bash
> bash scripts/coopid-gen-secrets.sh
> ```
>
> Это касается любого чекаута монорепы (mono-ai-1..5) после `git pull` ветки с
> этими изменениями, не только mono-ai-3. На prod секреты раскладывает плейбук
> `~/playbooks` — там скрипт-генератор не используется.

## Запуск

```bash
# 1. Секреты (один раз; идемпотентно — существующие не перезаписывает)
bash scripts/coopid-gen-secrets.sh

# 2. Весь стек
docker compose up -d
```

## Состав (в docker-compose.yaml)

| Сервис | Образ | Назначение |
|---|---|---|
| `postgres` | postgres:18 | Общий postgres. Кроме `voskhod` держит `authentik_db` и `coop_domain_db` (создаются init-скриптом на свежем томе либо вручную — см. ниже) |
| `authentik-server` | ghcr.io/goauthentik/server:2026.2 | OIDC Provider; UI/API на :9000 внутри сети |
| `authentik-worker` | ghcr.io/goauthentik/server:2026.2 | Фоновые задачи authentik |
| `caddy` | caddy:2.11 | Внешний HTTPS (TLS 1.3 min): `/api/coopback/*` → controller, остальное → authentik; JSON access-log |
| `crowdsec` | crowdsecurity/crowdsec:v1.7.8 | Разбор access-логов caddy (активный bouncer — Story 9.2) |

## Две БД в существующем postgres

`infra/coopid/postgres/init/01-init.sh` смонтирован в `/docker-entrypoint-initdb.d`
и заводит роли+БД **только при пустом data dir** (правило официального образа
postgres). Поэтому:

- **Свежая машина / пустой том** — `docker compose up -d` создаёт обе БД сам.
- **Уже инициализированный том** (как на текущих dev-стендах) — init-скрипт
  не запускается, БД заводятся вручную тем же SQL:

  ```bash
  AUTHPW=$(cat infra/coopid/secrets/coop_pg_authentik_password)
  APPPW=$(cat infra/coopid/secrets/coop_pg_app_password)
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -v apw="$AUTHPW" -v cpw="$APPPW" -U postgres -d postgres <<'SQL'
  CREATE ROLE authentik_user LOGIN PASSWORD :'apw';
  CREATE ROLE coop_app_user  LOGIN PASSWORD :'cpw';
  CREATE DATABASE authentik_db OWNER authentik_user;
  CREATE DATABASE coop_domain_db OWNER coop_app_user;
  REVOKE CONNECT ON DATABASE authentik_db   FROM PUBLIC;
  REVOKE CONNECT ON DATABASE coop_domain_db FROM PUBLIC;
  SQL
  ```

  Затем coopback на старте применит миграции `coop_domain_db` (V2.4.0/V2.4.1).

## Секреты

File-based Docker Secrets из `infra/coopid/secrets/` (каталог в `.gitignore`):
`coop_cert_key` (secp256k1 PEM — подпись `participant_certificate`),
`coop_vault_key`, `authentik_secret_key`, bootstrap-пароль/токен `akadmin`,
`authentik_webhook_token`, `auth_v2_session_binding_secret`, два пароля ролей
postgres. Суперюзер postgres — inline-пароль в compose, отдельного секрета нет.
В `.env`/compose значений секретов нет; контейнеры читают их из `/run/secrets/*`
(postgres-роли — через init-скрипт, authentik — `file://`, coopback — `*_FILE`).
На prod секреты раскладывает плейбук с правами `0400`.

## Порты (dev, mono-ai-3)

- `127.0.0.1:8443` — caddy HTTPS (self-signed при `COOPID_DOMAIN=localhost`)
- `127.0.0.1:8088` — caddy HTTP
- `127.0.0.1:9008` — authentik напрямую (мимо caddy, для отладки; `AUTHENTIK_HOST_PORT`)
- `127.0.0.1:5532` — postgres (обе БД, `PG_HOST_PORT`)

## Проверка

```bash
docker compose ps
# SNI обязателен: caddy с авто-TLS для localhost без SNI отдаёт TLS internal error.
curl -sk --tlsv1.3 --resolve localhost:8443:127.0.0.1 https://localhost:8443/ \
  -o /dev/null -w '%{http_code}\n'   # 302/200 от authentik (порт = CADDY_HTTPS_PORT)
# Ролевая изоляция (ожидаемо permission denied):
docker compose exec postgres psql -U coop_app_user -d authentik_db -c 'select 1'
```

Учётка администратора authentik: `akadmin`, пароль — в
`infra/coopid/secrets/authentik_bootstrap_password`.

## Бэкапы (Story 9.8)

Ежедневный `pg_basebackup` всего PG-кластера (обе БД сразу) → один gzip-tar → S3
`s3://{bucket}/{coopname}/{YYYY-MM-DD}.tar.gz` с SSE-S3. Retention 30 дней — через
S3 lifecycle rule (не ручным удалением). На каждый прогон — строка `audit_events`
(`coopid.backup.created`: `s3_key`, `size_bytes`, `duration_seconds`).

Скрипт: `infra/coopid/scripts/coopid-backup.sh`. Env:

```bash
export COOPNAME=voskhod                       # имя кооператива (обязательно)
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
export S3_BUCKET=coopid-backups               # дефолт
export S3_ENDPOINT=                           # пусто = реальный AWS S3; для MinIO: http://minio:9000
export RETENTION_DAYS=30                       # дефолт
export PG_CONTAINER=coop-postgres             # имя контейнера postgres
```

Один раз при деплое — создать bucket и поставить lifecycle:

```bash
COOPNAME=voskhod ./infra/coopid/scripts/coopid-backup.sh --setup
```

Cron (ставит прод-плейбук `~/playbooks`; локально — в crontab хоста), 03:00 UTC daily:

```cron
0 3 * * *  cd /path/to/mono && COOPNAME=voskhod AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
           ./infra/coopid/scripts/coopid-backup.sh >> /var/log/coopid-backup.log 2>&1
```

`--dry-run` печатает команды без выполнения. Восстановление — runbook
`docs/operations/disaster-recovery.md` (Story 9.9). Требования к PG: `wal_level>=replica`
(дефолт) и replication-доступ суперпользователя по локальному сокету контейнера.

## Troubleshooting

- **Init-скрипт postgres выполняется только при пустом data dir.** На живом томе
  заводите БД вручную (см. блок выше). Ротация паролей ролей — `ALTER ROLE`, не
  перегенерацией секрета.
- **Прод с реальным доменом:** задайте `COOPID_DOMAIN`, `CADDY_BIND=0.0.0.0`,
  `CADDY_HTTP_PORT=80`, `CADDY_HTTPS_PORT=443` — ACME HTTP-01 должен быть
  достижим снаружи на 80/443.
- **authentik на postgres:18:** официальная поддержка на pg16, но pg18 как
  сервер обратносовместим (Django+psycopg). На dev/testnet общий postgres
  используется сознательно — единый стек одной командой важнее версии-в-версию.
