# 🚀 @coopenomics/boot

CLI-утилита для инициализации блокчейн-инфраструктуры кооператива. Создаёт системные аккаунты, устанавливает смарт-контракты, настраивает токены и разворачивает кооперативную среду. Включает интеграционные тесты для основных подсистем платформы.

## Основные возможности

- Полный цикл развёртывания блокчейна EOSIO — от запуска ноды до создания кооператива
- Установка системных и прикладных смарт-контрактов
- Инициализация токенов и создание тестовых данных
- Управление Docker-контейнерами блокчейн-ноды
- Интеграционные тесты: паевые взносы (capital), кошелёк (wallet), регистрация участников (registrator)
- Поддержка нескольких режимов загрузки: стандартный, чистый и расширенный

## Установка

Компонент является частью монорепозитория. Установка зависимостей из корня проекта:

```bash
pnpm install
```

Или только для этого компонента:

```bash
pnpm install --filter @coopenomics/boot
```

## Скрипты

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `boot` | `pnpm run boot` | Запуск блокчейна и установка контрактов |
| `boot:clean` | `pnpm run boot:clean` | Чистый запуск с полной переустановкой |
| `boot:extra` | `pnpm run boot:extra` | Расширенная инициализация с дополнительными данными |
| `deploy` | `pnpm run deploy` | Развёртывание контрактов на запущенной ноде |
| `cli` | `pnpm run cli` | Интерактивный командный интерфейс (Commander.js) |
| `clear` | `pnpm run clear` | Очистка данных блокчейна |
| `start` | `pnpm run start` | Перезапуск ноды |
| `stop` | `pnpm run stop` | Остановка ноды |
| `test` | `pnpm run test` | Интеграционные тесты (capital) |
| `test:all` | `pnpm run test:all` | Все интеграционные тесты |

## Конфигурация

Скопируйте `.env-example` в `.env` и настройте переменные окружения:

- Endpoint блокчейн-ноды (API)
- Строка подключения к MongoDB
- Строка подключения к реляционной БД
- Приватные ключи для развёртывания контрактов

Подробное описание переменных — в файле `.env-example`.

## Запуск bootstrap'а в стороннем проекте (sideboot)

Для проектов, которым нужна **только цепь + контракты** (без mongo/pg/mono-инфры),
есть готовый docker-образ `dicoop/bootcoop:<branch>`. Он one-shot job'ом
накатывает на удалённую ноду все системные и кооперативные контракты,
активирует протокол-фичи, создаёт системный токен.

Минимальный `docker-compose.yaml` для стороннего репозитория:

```yaml
services:
  node:
    image: dicoop/blockchain:latest
    ports:
      - "8888:8888"
      - "9876:9876"
    volumes:
      - ./blockchain-data:/mnt/dev/data
    command: >
      /bin/bash -c "/usr/local/bin/nodeos -d /mnt/dev/data
        --config-dir /mnt/dev/config
        --genesis-json /mnt/dev/config/genesis.json"

  bootcoop:
    image: dicoop/bootcoop:dev      # или :testnet / :main / :latest
    depends_on: [node]
    restart: "no"
    environment:
      CHAIN_URL: http://node:8888
      EOSIO_PUB_KEY: EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV
      EOSIO_PRV_KEY: 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
      RPC_WAIT_TIMEOUT_MS: "180000"
```

Запуск:

```bash
docker compose up -d node
docker compose up bootcoop          # one-shot, выходит после успеха
```

Bootcoop ждёт `${CHAIN_URL}/v1/chain/get_info`, затем катит контракты на ноду.
По выходу с кодом 0 — цепь готова к работе.

### Версионирование

`dicoop/bootcoop:<tag>` всегда multi-stage'ится из `dicoop/contracts:<tag>` с
тем же `<tag>` (dev/testnet/main). Контракты и bootstrap синхронны по sha
коммита mono-репо — no skew.

Точный пин по коммиту: `dicoop/bootcoop:dev-<short-sha>` (тегается каждой сборкой).

### Дополнительные данные (опционально)

Если в стороннем проекте всё же нужны mono-данные (voskhod, ant, совет) —
выставить флаги, и поднять рядом mongo + postgres:

```yaml
    environment:
      CHAIN_URL: http://node:8888
      MONGO_URI: mongodb://mongo:27017/cooperative-x
      POSTGRES_HOST: postgres
      POSTGRES_USERNAME: postgres
      POSTGRES_PASSWORD: postgres!23!23
      POSTGRES_DATABASE: voskhod
      INSTALL_INITIAL_DATA: "1"     # voskhod + ant + совет
      INSTALL_EXTRA_DATA:   "1"     # + расширенный совет (5 пайщиков)
```

Без этих флагов запускается чистый chain-only сценарий.

## Тестирование

Перед запуском тестов необходима работающая инфраструктура (см. `docker-compose.yaml` в корне проекта):

```bash
pnpm --filter @coopenomics/boot run test
pnpm --filter @coopenomics/boot run test:all
```

Тесты используют **Vitest** с таймаутом 240 секунд — это связано с ожиданием подтверждения блокчейн-транзакций.

## Архитектура

```
src/
├── index.ts              # Точка входа CLI (Commander.js)
├── init/                 # Логика инициализации
│   ├── booter.ts         # Загрузчик блокчейна
│   ├── cooperative.ts    # Настройка кооператива
│   ├── infra.ts          # Инфраструктурная инициализация
│   └── participant.ts    # Создание участников
├── blockchain/           # Взаимодействие с EOSIO (eosjs)
├── docker/               # Управление Docker-контейнерами
├── configs/              # Конфигурация ноды и протокол-фичи
├── tests/                # Интеграционные тесты
│   ├── capital.test.ts   # Тесты паевых взносов
│   ├── wallet.test.ts    # Тесты кошелька
│   └── registrator.test.ts # Тесты регистрации
└── utils/                # Вспомогательные утилиты
scripts/
├── reboot.sh             # Полный перезапуск
├── clean_reboot.sh       # Чистый перезапуск
└── extra_reboot.sh       # Расширенный перезапуск
```

## Ключевые зависимости

- **eosjs** — взаимодействие с блокчейном EOSIO
- **commander** — CLI-фреймворк
- **dockerode** — управление Docker-контейнерами из Node.js
- **mongoose** — работа с MongoDB
- **pg** — работа с реляционной БД
- **vitest** — тестирование

## Лицензия

[BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.ru)
