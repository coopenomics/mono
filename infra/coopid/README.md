# CoopID — инфраструктура per-coop (Story 1.1)

Стек OIDC-аутентификации кооператива: authentik 2026.2 (server + worker),
выделенный postgres:16 с двумя БД, caddy (внешний TLS 1.3) и crowdsec.
Подключается к базовому дев-стеку двумя аддитивными overlay-файлами —
существующие сервисы (`postgres` 18/voskhod, `monoredis`, `coopback`, `desktop`)
не изменяются и не пересоздаются.

## Запуск

```bash
# 1. Секреты (один раз; идемпотентно)
bash scripts/coopid-gen-secrets.sh

# 2. Весь стек с overlays
docker compose -f docker-compose.yaml -f docker-compose.authentik.yml -f docker-compose.edge.yml up -d
```

Чтобы не повторять `-f`-цепочку, можно добавить в `.env`:

```
COMPOSE_FILE=docker-compose.yaml:docker-compose.authentik.yml:docker-compose.edge.yml
```

## Состав

| Сервис | Образ | Назначение |
|---|---|---|
| `coop-postgres` | postgres:16 | Две БД: `authentik_db` (роль `authentik_user`) и `coop_domain_db` (роль `coop_app_user`); ролевая изоляция — подключение только владельцу |
| `authentik-server` | ghcr.io/goauthentik/server:2026.2 | OIDC Provider; UI/API на :9000 внутри сети |
| `authentik-worker` | ghcr.io/goauthentik/server:2026.2 | Фоновые задачи authentik |
| `caddy` | caddy:2.11 | Внешний HTTPS (TLS 1.3 min): `/api/coopback/*` → controller, остальное → authentik; JSON access-log |
| `crowdsec` | crowdsecurity/crowdsec:v1.7.8 | Разбор access-логов caddy (активный bouncer — Story 9.2) |

Redis отдельно не поднимается: authentik использует существующий `monoredis`
(DB-индекс 1; controller сидит в индексе 0 по умолчанию).

## Секреты

Все секреты — file-based Docker Secrets из `infra/coopid/secrets/` (каталог в
`.gitignore`): `coop_cert_key` (secp256k1 PEM — подпись `participant_certificate`),
`coop_vault_key`, `authentik_secret_key`, bootstrap-пароль/токен `akadmin`,
три пароля postgres. В `.env` и compose значений секретов нет; контейнеры
читают их из `/run/secrets/*` (postgres — `*_FILE`, authentik — `file://`-схема).
На prod секреты раскладывает плейбук с правами `0400`.

## Порты (dev, INSTANCE_INDEX=1)

- `127.0.0.1:8443` — caddy HTTPS (self-signed при `COOPID_DOMAIN=localhost`)
- `127.0.0.1:8088` — caddy HTTP
- `127.0.0.1:9008` — authentik напрямую (мимо caddy, для отладки)
- `127.0.0.1:5632` — coop-postgres

## Проверка

```bash
docker compose -f docker-compose.yaml -f docker-compose.authentik.yml -f docker-compose.edge.yml ps
curl -sk --tlsv1.3 https://127.0.0.1:8443/ -o /dev/null -w '%{http_code}\n'   # 2xx/3xx от authentik
# Ролевая изоляция (ожидаемо: permission denied):
docker compose exec coop-postgres psql -U coop_app_user -d authentik_db -c 'select 1'
```

Учётка администратора authentik: `akadmin`, пароль — в
`infra/coopid/secrets/authentik_bootstrap_password`.

## Troubleshooting

- **Init-скрипты postgres выполняются только при пустом data dir.** Если первый
  старт coop-postgres упал на середине init (healthcheck вечно красный, БД/ролей
  нет) или вы перегенерировали pg-пароли при живом volume — пересоздайте том:
  `docker compose ... stop coop-postgres && docker compose ... rm -f coop-postgres
  && docker volume rm <project>_coop_postgres_data`, затем `up -d` заново.
  Ротация паролей живой БД делается `ALTER ROLE`, не перегенерацией секрета.
- **Прод с реальным доменом:** задайте `COOPID_DOMAIN`, `CADDY_BIND=0.0.0.0`,
  `CADDY_HTTP_PORT=80`, `CADDY_HTTPS_PORT=443` — ACME HTTP-01 должен быть
  достижим снаружи на 80/443.
