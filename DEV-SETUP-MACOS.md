# Запуск mono dev-стека на macOS

Полная пошаговая инструкция, как поднять backend (`coopback`) + parser (`cooparser`) + блокчейн-ноду + БД на macOS через Docker Desktop. Прошёл — отметь, ниже разобраны типичные грабли.

## TL;DR

```bash
cd ~/dacom-code/foundation/monocoop
docker compose up -d                                                    # 1. поднять базу
./scripts/dev-setup-macos.sh                                            # 2. одной командой (см. ниже скрипт)
```

Если скрипта ещё нет — выполняй шаги ниже руками.

## Шаги

### 1. Поднять контейнеры

```bash
docker compose up -d
```

Поднимутся: `node` (NodeOS), `mongo`, `monoredis`, `postgres`, `coopback`, `cooparser`. **MinIO** входит в дефолт. **OpenSearch** — нет (тяжёлый, см. опц. сервисы).

### 2. Проверить чтоб .env'ы указывали на service-имена, а не localhost

`components/controller/.env`:
- `MONGODB_URL=mongodb://mongo:27017/cooperative-x`
- `REDIS_HOST=monoredis`
- `POSTGRES_HOST=postgres`, `POSTGRES_PASSWORD=postgres!23!23`
- `BLOCKCHAIN_RPC=http://node:8888`
- `SIMPLE_EXPLORER_API=http://cooparser:4000`
- `MINIO_ENDPOINT=minio:9000`
- `CHAIN_ID=<реальный chain_id, см. ниже>`

`components/parser/.env`:
- `MONGO_EXPLORER_URI=mongodb://mongo:27017/cooperative-x`
- `REDIS_HOST=monoredis`
- `API=http://node:8888`
- `SHIP=ws://node:8080`

**Почему service-имена:** все контейнеры в bridge-сети `monocoop_default`. Внутри контейнера `127.0.0.1` = сам контейнер, не host. На macOS `network_mode: host` в Docker Desktop работает плохо — используем bridge + service names.

### 3. Узнать живой chain_id

```bash
curl -s http://localhost:8888/v1/chain/get_info | jq -r .chain_id
```

И вписать в `components/controller/.env` → `CHAIN_ID=...`. **Если chain_id в .env не совпадает с живым — on-chain транзакции упадут на verify, хотя приложение запустится.**

### 4. Если правил .env — пересоздать контейнер (не restart!)

```bash
docker compose up -d --force-recreate --no-deps coopback cooparser
```

`docker restart` **не перечитывает** `env_file`. `--no-deps` — чтобы не пересоздавать БД (потеряются данные).

### 5. Native binding libxmljs2 — пересборка под Linux

На свежем чекауте `pnpm install` запускается на macOS, и `libxmljs2` собирает Mach-O бинарник. В Linux-контейнере он падает:

```
Error: .../xmljs.node: invalid ELF header  ERR_DLOPEN_FAILED
```

**Фикс** (один раз после `pnpm install`):

```bash
docker exec monocoop-coopback-1 sh -c '
  cd /app/node_modules/.pnpm/libxmljs2@0.37.0/node_modules/libxmljs2 \
  && rm -rf build \
  && PATH="$PWD/node_modules/.bin:$PATH" npm run install
'
docker restart monocoop-coopback-1
```

Проверка — magic bytes Linux ELF:
```bash
docker exec monocoop-coopback-1 sh -c \
  'head -c 4 /app/node_modules/.pnpm/libxmljs2@0.37.0/node_modules/libxmljs2/build/Release/xmljs.node | od -c -N 4'
# Должно быть:  177   E   L   F
# Если cf fa ed fe — это macOS Mach-O, фикс не применился.
```

### 6. Дождаться cold-start coopback (~5–6 минут)

`ts-node` без cache + DI tree NestJS = долго. Первые логи появляются спустя ~5 минут после старта контейнера.

```bash
docker logs -f monocoop-coopback-1 | grep -E 'NestJS app|Nest application|Error'
```

Готово, когда видишь:
```
Nest application successfully started
NestJS app with Express routes running on port 2998
```

Проверка:
```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"query":"{__typename}"}' http://localhost:2998/v1/graphql
# {"data":{"__typename":"Query"}}
```

## Опциональные сервисы

### OpenSearch (поиск)

```bash
docker compose --profile search up -d opensearch
```

Затем в `components/controller/.env`:
```
OPENSEARCH_ENABLED=true
```
И пересоздать coopback:
```bash
docker compose up -d --force-recreate --no-deps coopback
```

## Грабли (если опять провозился пол-дня)

| Симптом | Причина | Фикс |
|---|---|---|
| `invalid ELF header` | host'овый `pnpm install` положил Mach-O | См. п. 5 — пересборка libxmljs2 в контейнере |
| `MongooseServerSelectionError: ECONNREFUSED 127.0.0.1:27017` | .env на localhost вместо service-имени | См. п. 2 |
| `password authentication failed for user "postgres"` | в .env `POSTGRES_PASSWORD=postgres` вместо `postgres!23!23` | См. п. 2 |
| Coopback ушёл в restart-loop, но рядом есть другой `monocoop-coopback-1` Up | Случайно запустился старый `components/controller/docker-compose.yml` (network_mode: host, без bind-mount, без CMD) | `docker stop coopback && docker rm coopback` |
| `docker restart` не подхватил новые переменные .env | `restart` не перечитывает `env_file` | `docker compose up -d --force-recreate --no-deps <svc>` |
| Coopback зависает на 5+ минут, лога нет | Это нормально для cold-start ts-node | Подождать. CPU должен крутиться ≥50%. Если CPU = 0% — другая проблема |
| `[VaultDomainService] Ошибка при получении WIF... bad decrypt` | SERVER_SECRET не совпадает с тем, чем шифровали WIF в БД | См. CLAUDE.md → раздел Vault & SERVER_SECRET. Дефолт — `SECRET` |
| Транзакции падают на on-chain verify | CHAIN_ID в .env не совпадает с живым | См. п. 3 |
| `Custom endpoint \`minio://9000\` was not a valid URI` на bootstrap | `MINIO_ENDPOINT` без схемы | `MINIO_ENDPOINT=http://minio:9000` (со схемой!) |
| nodeos в restart-loop с `Database dirty flag set` после sleep/crash Docker Desktop | unclean shutdown chain state | `docker stop monocoop-node-1`; `mv blockchain-data/state-history{,.broken-$(date +%s)}`; `docker compose up -d node` — nodeos сам сделает replay |
| Cold-start coopback 10+ минут (вместо обычных 3-5) | ts-node без cache + bind-mount через osxfs + параллельная нагрузка (nodeos replay) | Подождать; в будущем — `tsx` / `ts-node --swc` для dev-режима |
