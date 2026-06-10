# CoopID — Disaster Recovery Runbook

Восстановление кооператива из ежедневного S3-бэкапа (Story 9.8) после потери
сервера. Цель — **RTO 1–2 часа** до прохождения smoke-теста.

> **Формат бэкапа.** `coopid-backup.sh` снимает **физический** `pg_basebackup`
> всего PG-кластера (обе БД сразу) в `s3://{bucket}/{coopname}/{YYYY-MM-DD}.tar.gz`.
> Это НЕ логический `pg_dump` → восстановление выполняется **распаковкой архива в
> каталог данных PostgreSQL (PGDATA)**, а не командой `pg_restore`.

> Этот runbook — базовый сценарий восстановления PG. Сценарные runbook'и
> DR-01..DR-04 (Story 9.10) ссылаются на него.

## 0. Предпосылки

- Доступ к S3-бакету `coopid-backups` (ключи `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).
- Известны: `COOPNAME` и дата бэкапа (`YYYY-MM-DD`), который восстанавливаем.
- **Секреты кооператива** на момент снятия бэкапа: каталог `infra/coopid/secrets/`
  (особенно `coop_pg_app_password`, `coop_pg_authentik_password`) — их пароли ДОЛЖНЫ
  совпадать с тем, что в бэкапе (см. §6, грабля №1). Храните их вместе с бэкапами
  или будьте готовы к `ALTER ROLE`.

## 1. Новый сервер с Docker

```bash
# Ubuntu/Debian; на ноде нужны docker + docker compose v2 и aws CLI.
curl -fsSL https://get.docker.com | sh
git clone <repo> mono && cd mono            # тот же репозиторий
# разложить секреты (ТЕ ЖЕ, что при снятии бэкапа — см. §6 грабля №1)
bash scripts/coopid-gen-secrets.sh          # ТОЛЬКО если секреты потеряны (см. §6)
```

## 2. Скачать backup из S3

```bash
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
COOPNAME=voskhod ; DATE=2026-06-10
aws s3 cp "s3://coopid-backups/${COOPNAME}/${DATE}.tar.gz" ./backup.tar.gz
# проверить, что архив не пустой и валиден:
gzip -t backup.tar.gz && tar -tzf backup.tar.gz | head    # должен показать PG_VERSION, base/, global/, pg_wal/
```

## 3. Восстановить в новый PG-том (распаковка в PGDATA)

postgres:18: `PGDATA=/var/lib/postgresql/18/docker`, том примонтирован на родитель
`/var/lib/postgresql`. Имя тома — `{project}_postgres_data` (project = имя каталога
репозитория, напр. `mono_postgres_data`). Стек должен быть остановлен.

```bash
PROJECT=mono                                   # docker compose project name
docker compose down                            # если что-то поднято

# чистый том
docker volume rm ${PROJECT}_postgres_data 2>/dev/null || true
docker volume create ${PROJECT}_postgres_data

# распаковать содержимое архива в PGDATA внутри тома
docker run --rm -v ${PROJECT}_postgres_data:/v -v "$PWD":/b alpine sh -c '
  mkdir -p /v/18/docker &&
  tar -xzf /b/backup.tar.gz -C /v/18/docker &&
  chown -R 999:999 /v/18/docker'             # postgres в образе работает под uid 999
```

WAL включён в базовый бэкап (`pg_basebackup -X fetch`), поэтому при старте PG сам
выполнит crash-recovery и поднимется на момент бэкапа. PITR (точка во времени между
бэкапами) в MVP не предусмотрен — восстановление до состояния выбранного дня.

## 4. Поднять стек

```bash
docker compose up -d
docker compose ps                              # postgres healthy → authentik healthy → coopback/caddy
docker compose logs -f postgres | grep -m1 "database system is ready to accept connections"
```

## 5. Smoke-test (вход → сертификат → цепочка)

Проверяем сквозной контур CoopID одним пайщиком.

```bash
BASE=https://localhost:8443      # caddy (или прод-домен); SNI обязателен для localhost
COOP=voskhod

# (a) Вход: пароль на authentik → session_binding_token.
#     Проще всего — через SDK @coopenomics/auth (login(email,password)),
#     ниже — эквивалент curl поверх endpoint'ов Эпика 1:
#  1) получить сессию authentik (UI-флоу или /api/v3/flows/...), сохранить cookie;
#  2) обменять на binding-cookie:
curl -sk "$BASE/coop/session/bind" -X POST -b authentik_cookies.txt -c binding.txt -w '%{http_code}\n'
#     ожидаемо 204 + cookie coop_session_binding

# (b) Второй этап: подпись метки времени ключом пайщика (SDK signTimestamp) →
curl -sk "$BASE/coop/verify/timestamp" -X POST -b binding.txt \
  -H 'Content-Type: application/json' \
  -d '{"signature":"SIG_K1_...","timestamp":"<ISO>","binding_token":"<jwt>"}'
#     ожидаемо 200 + {access_token, refresh_token, participant_certificate?}

# (c) Выпуск/получение сертификата:
curl -sk "$BASE/coop/certificate" -H "Authorization: Bearer <access_token>"
#     ожидаемо 200 + {participant_certificate: "<compact JWS>"}

# (d) Проверка цепочки coop_chain в сертификате:
echo "<participant_certificate>" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.coop_chain'
#     ожидаемо массив [ano, voskhod, vostok]; coopname совпадает; iat/exp валидны
```

**Критерий успеха smoke-теста:** пайщик вошёл, сертификат выпущен, `coop_chain`
содержит полную цепочку доверия. Если все три шага зелёные — кооператив восстановлен.

## 6. Troubleshooting (частые грабли)

**№1. authentik/coopback не подключаются к БД (`password authentication failed`).**
Главная грабля. Пароли ролей `authentik_user`/`coop_app_user` хранятся ВНУТРИ бэкапа
(`pg_authid`). Init-скрипт `infra/coopid/postgres/init/01-init.sh` выполняется ТОЛЬКО
на пустом томе — на восстановленном он НЕ запускается, роли уже есть из бэкапа.
→ Либо разложить в `infra/coopid/secrets/` ТЕ ЖЕ пароли, что были при снятии бэкапа;
либо привести пароли ролей под текущие секреты:

```bash
docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 \
  -v apw="$(cat infra/coopid/secrets/coop_pg_authentik_password)" \
  -v cpw="$(cat infra/coopid/secrets/coop_pg_app_password)" <<'SQL'
ALTER ROLE authentik_user PASSWORD :'apw';
ALTER ROLE coop_app_user  PASSWORD :'cpw';
SQL
```

**№2. PG не стартует, `data directory ... has wrong ownership`.** Файлы PGDATA должны
принадлежать uid 999 (postgres в образе). Повторите `chown -R 999:999 /v/18/docker`
(см. §3).

**№3. PG не стартует, несовпадение мажорной версии (`incompatible ... PG_VERSION`).**
Физический бэкап восстановим ТОЛЬКО на ту же мажорную версию PostgreSQL (18).
Используйте образ `postgres:18`. Кросс-версионно — только логический dump (вне MVP).

**№4. `gzip -t` падает / `tar` обрывается.** Архив битый или скачан не полностью —
возьмите соседний день (retention 30 дней) и повторите §2.

**№5. S3: AccessDenied / NoSuchKey.** Проверьте ключи, бакет, регион и что объект
ещё не истёк по lifecycle (хранятся 30 дней). При SSE-S3 на чтение доп-действий не нужно.

**№6. caddy «TLS internal error» на localhost.** Запрос без SNI — добавьте
`--resolve localhost:8443:127.0.0.1` (см. `infra/coopid/README.md`).

## RTO

Ожидаемое время восстановления — **1–2 часа**: ~15 мин подготовка сервера, ~10–40 мин
скачивание+распаковка (зависит от размера БД и канала), ~10 мин старт стека и миграций,
~15 мин smoke-test и устранение граблей §6. Цель RTO для MVP — **≤ 2 часов**.
