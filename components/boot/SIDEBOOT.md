# Sideboot — локальная нода + контракты в стороннем репозитории

Краткая инструкция для агентов в соседних репозиториях (parser2,
blockchain-protocol и т.п.), которым нужна чистая EOSIO-нода с
развёрнутыми кооперативными контрактами для интеграционных тестов.
**Без mono-инфры (mongo/postgres/desktop)**.

## Артефакты в DockerHub

| Образ | Назначение | Тег |
|---|---|---|
| `dicoop/blockchain` | EOSIO node (nodeos + cdt) | `latest` |
| `dicoop/contracts` | wasm/abi артефакт со всеми контрактами | `dev` / `testnet` / `main` / `latest` |
| `dicoop/bootcoop` | one-shot bootstrap (накатывает контракты на ноду) | `dev` / `testnet` / `main` / `latest` |

`dicoop/contracts` и `dicoop/bootcoop` синхронны по тегу — `dicoop/bootcoop:dev`
multi-stage из `dicoop/contracts:dev` (no skew).

`:latest` появляется только при сборке main-ветки. Для разработки
используй `:dev`.

## Минимальный docker-compose.yaml

```yaml
services:
  node:
    image: dicoop/blockchain:latest
    ports:
      - "8888:8888"
      - "9876:9876"
    volumes:
      - ./blockchain-data:/mnt/dev/data
      - ./node-config:/mnt/dev/config
    command: >
      /bin/bash -c "/usr/local/bin/nodeos -d /mnt/dev/data
        --config-dir /mnt/dev/config
        --genesis-json /mnt/dev/config/genesis.json"
    healthcheck:
      test: ["CMD", "curl", "-fs", "http://localhost:8888/v1/chain/get_info"]
      interval: 2s
      timeout: 2s
      retries: 60

  bootcoop:
    image: dicoop/bootcoop:dev
    depends_on:
      node:
        condition: service_started
    restart: "no"
    environment:
      CHAIN_URL: http://node:8888
      EOSIO_PUB_KEY: EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV
      EOSIO_PRV_KEY: 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
      RPC_WAIT_TIMEOUT_MS: "180000"
```

## Конфиги ноды

`./node-config/` должен содержать:
- `genesis.json`
- `config.ini`
- `protocol_features/` (директория с JSON-файлами фич)

Источник этих конфигов — `components/boot/src/configs/` в репо
`coopenomics/mono`. Скопируй их в свой репозиторий или подмонтируй
оттуда напрямую (если репо клонирован рядом):

```yaml
volumes:
  - /path/to/mono/components/boot/src/configs:/mnt/dev/config
```

Это dev-конфигурация (single-node BPACCOUNT=eosio, ключи из
`.env-example` boot'а).

## Запуск

```bash
docker compose up -d node
docker compose up bootcoop          # one-shot, выходит exit 0 после успеха
```

Время первого запуска: ~2-3 минуты (бутстрап накатывает 14+ контрактов
и создаёт 1000+ Registry-шаблонов).

После успеха цепь готова — все кооперативные аккаунты с задеплоенными
контрактами, выпущен токен AXON (eosio имеет 88000.0000 AXON свободно),
оператор `voskhod` получил powerup и стартовый transfer.

## Чистый перезапуск

Контракты накатываются на дев-цепь idempotent'но — повторный запуск
bootcoop без сброса данных может работать, но идеоматично сбрасывать
полностью. Так что:

```bash
# 1. Останови всё с удалением volumes/data
docker compose down -v
sudo rm -rf ./blockchain-data

# 2. Подними заново
docker compose up -d node
docker compose up bootcoop
```

Один-в-один как `pnpm run reboot:clean` в mono-репо, но без mono-инфры.

## Проверка что цепь готова

```bash
# Нода отвечает
curl -s http://localhost:8888/v1/chain/get_info | jq .head_block_num

# Контракты установлены (должны быть code_hash != 000...0)
for acct in eosio registrator soviet draft fund gateway capital wallet contributor marketplace meet branch loan apps; do
  hash=$(curl -s -X POST http://localhost:8888/v1/chain/get_code -d "{\"account_name\":\"$acct\"}" | jq -r .code_hash)
  echo "$acct: $hash"
done
```

Все hash'и должны быть не нулевыми (кроме сейчас намеренно отключенного
`ledger2` — он закомментирован в `components/contracts/CMakeLists.txt`,
вернётся когда раскомментируется).

## Опциональная mono-data

Если нужны mono-демо-данные (кооператив "voskhod", пайщик ant, совет —
требует `mongo` + `postgres` рядом):

```yaml
    environment:
      CHAIN_URL: http://node:8888
      MONGO_URI: mongodb://mongo:27017/cooperative-x
      POSTGRES_HOST: postgres
      POSTGRES_USERNAME: postgres
      POSTGRES_PASSWORD: postgres!23!23
      POSTGRES_DATABASE: voskhod
      INSTALL_INITIAL_DATA: "1"     # voskhod + ant + совет (single chairman)
      INSTALL_EXTRA_DATA:   "1"     # + расширенный совет (5 пайщиков)
```

Без этих флагов — чистый chain-only сценарий, ничего в БД не
записывается.

## Версионирование и пины

Точный пин на конкретный коммит mono:

```yaml
image: dicoop/bootcoop:dev-abc1234
```

Тегается каждой сборкой как `<branch>-<short-sha>`. Используй когда
нужна воспроизводимость (CI-тесты).

## Куда смотреть в коде

Если что-то в `bootcoop` идёт не так:

- `components/boot/src/index.ts` — CLI команды, ищи `boot:remote`
- `components/boot/src/init/infra.ts` — `startInfra()` — что и как деплоится
- `components/boot/src/configs/contracts.ts` — список контрактов и путей к wasm/abi
- `components/boot/src/configs/index.ts` — список аккаунтов, ключи, token spec
- `components/boot/Dockerfile` — как образ собирается (multi-stage)
- `.github/workflows/build-bootstrap.yaml` — CI workflow
- `.github/workflows/build-contracts.yaml` — workflow `dicoop/contracts`
- `components/contracts/CMakeLists.txt` — какие контракты собираются (`add_contract_build(<name>)`)

## Известные ограничения

- `boot:remote` логирует ошибки деплоя контрактов (`ENOENT: ledger2.wasm`)
  но не падает — exit 0 даже если часть контрактов не установилась.
  После запуска ОБЯЗАТЕЛЬНО проверь list контрактов через `get_code`,
  не доверяй только exit-коду.
- `dicoop/contracts:dev` ребилдится только при изменении файлов в
  `components/contracts/cpp/` или `CMakeLists.txt` (см. `paths:` в
  `build-contracts.yaml`). Если контракт обновлён, но workflow не
  тригернулся — `workflow_dispatch` руками.
- `dicoop/bootcoop:dev` ребилдится при изменении `components/boot/**`
  ИЛИ `.github/workflows/build-bootstrap.yaml`. На обновление
  контрактов нужен ручной rebuild bootcoop (или rerun workflow), чтобы
  multi-stage подхватил свежий `dicoop/contracts:dev`.
