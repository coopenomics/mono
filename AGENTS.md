# AGENTS.md

## Cursor Cloud specific instructions

### Обзор

Монорепозиторий «Цифровой Кооператив» (monocoop) — платформа управления кооперативами на блокчейне EOSIO. pnpm v9 + Lerna. Node.js v20.

### Сервисы

| Компонент | Контейнер | Порт | Описание |
|-----------|-----------|------|----------|
| controller | coopback | 2998 | NestJS GraphQL API |
| desktop | desktop | 2999 | Vue 3 + Quasar SPA |
| parser | cooparser | 4000 | Индексация блокчейна через SHiP |
| blockchain | node | 8888, 8070 | EOSIO node + State History Plugin |
| MongoDB | mongo | 27017 | Основная БД (replica set) |
| Redis | monoredis | 6379 | Кэш и стримы |
| PG | (см. compose) | 5532→5432 | Реляционная БД |

### Полный перезапуск (одна команда)

```
pnpm run reboot
```

Делает: останавливает контейнеры → чистит blockchain data и volumes → поднимает инфру → ждёт готовности → `pnpm run boot` → запускает parser и controller.

### Первоначальная настройка Cloud-окружения

1. **`/etc/hosts`** — обязательно для boot (запускается на хосте, обращается к MongoDB по docker hostname):
   ```
   echo "127.0.0.1 mongo" | sudo tee -a /etc/hosts
   echo "127.0.0.1 monoredis" | sudo tee -a /etc/hosts
   ```

2. **WeasyPrint** — системная зависимость для генерации PDF:
   ```
   sudo apt-get install -y python3 python3-venv libpango-1.0-0 libcairo2 libffi-dev libjpeg-dev libopenjp2-7-dev libharfbuzz-dev
   sudo python3 -m venv /opt/weasyprint-venv && sudo /opt/weasyprint-venv/bin/pip install WeasyPrint==67
   sudo ln -sf /opt/weasyprint-venv/bin/weasyprint /usr/local/bin/weasyprint
   ```

3. **Контракты** (test-режим — позволяет boot с 1 членом совета):
   ```
   cd components/contracts && sudo rm -rf build && bash build-all.sh test
   ```

4. **Shared-библиотеки** (порядок важен):
   ```
   pnpm --filter cooptypes run build
   pnpm --filter @coopenomics/factory run build
   pnpm --filter @coopenomics/sdk run build
   pnpm --filter @coopenomics/notifications run build
   ```

5. **`.env` файлы** — скопировать из `.env-example`, адаптировать hostnames:
   - Controller/Parser (в Docker): хосты по именам контейнеров из docker-compose (порт БД 5432)
   - Boot (на хосте): `127.0.0.1`, PG порт `5532`, mongo через `/etc/hosts`
   - Desktop: `127.0.0.1`
   - **CHAIN_ID**: берётся из `curl http://localhost:8888/v1/chain/get_info` после старта ноды
   - Controller требует `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY`

6. **Запуск**: `pnpm run reboot`, затем `docker compose up -d --force-recreate coopback cooparser` (если .env менялись)

### Запуск тестов

- **Factory** (`components/factory`): нужен только MongoDB. Запуск:
  ```
  NODE_ENV=test SOURCE=local MONGO_URI=$MONGO_URI SKIP_BLOCK_FETCH=TRUE pnpm --filter @coopenomics/factory test
  ```
  `MONGO_URI` по умолчанию: `mongodb://<host>:27017/cooperative-x`.
- **Boot** (`components/boot`): требует полный EOSIO blockchain + MongoDB + PG. Запуск после `pnpm run reboot`:
  ```
  pnpm --filter @coopenomics/boot test
  ```
- **Duplicate transaction** — в boot-тестах EOSIO отклоняет транзакции с одинаковым хешем (TAPOS block + action data). При повторном вызове `refreshSegment` для того же участника — добавить `await sleep(500)` перед ним. Паттерн уже используется (см. комментарий на строке ~720 capital.test.ts).

### Архитектура расширений (Extension System)

Платформа использует модульную архитектуру с тремя типами модулей:

**1. Core-модули** — встроены в ядро (`controller/src/extensions/`), распространяются вместе с платформой.

**2. Приватные расширения** — отдельные npm-пакеты `@coopenomics/ext-*`, устанавливаемые в node_modules. Загружаются динамически через `ExtensionLoaderService` при старте.

**3. Внешние приложения** — подключаются по URL через iframe.

**Пакет `@coopenomics/interops`** (`components/interops/`) — связующий контракт:
- Доменные порты (`IAccountDataPort`, `IDocumentDataPort`, `IWalletDomainPort`, ...)
- Контракт расширения (`IExtensionModule`, `IExtensionMetadata`)
- Контракт загрузчика (`IExtensionLoader`)
- Shared-типы (`IPaginationInput`, `IBaseDatabaseData`)

**Как создать расширение:**
1. Создать npm-пакет `@coopenomics/ext-<name>`
2. Зависимость: `@coopenomics/interops`
3. Экспортировать default объект, реализующий `IExtensionModule`
4. `getMetadata()` — метаданные (имя, версия, иконка, десктопы)
5. `getBackendModule()` — NestJS DynamicModule
6. `getFrontendManifest()` — опционально, маршруты для desktop

**Динамическая загрузка:**
- `ExtensionLoaderService` сканирует `node_modules/@coopenomics/ext-*`
- Вызывает `require(packageName)` → `getMetadata()` → `getBackendModule()`
- Подключает NestJS-модуль к AppModule при старте
- GraphQL-схема обновляется при перезапуске сервера

### Критические gotchas

- **SHiP порт 8070** — `state-history-endpoint = 0.0.0.0:8070` в config.ini. Парсер: `SHIP=ws://node:8070`.
- **Парсер START_BLOCK**: при `START_BLOCK=1` на чистой БД стартует с HEAD и делает частичную инициализацию. Для полного replay: временно `START_BLOCK=2`, после первого запуска вернуть `1`.
- **SSR desktop в dev** — расширения не рендерятся из-за Pinia SSR-сериализации компонентов. Dev — SPA (`quasar dev`), production build SSR работает.
- **Тестовые учётные данные**: email `ivanov@example.com`, ключ — дефолтный EOSIO dev key (см. `components/boot/.env-example`), пользователь `ant` (председатель).
- **Docker hostnames**: без `network_mode: host` — контейнеры обращаются друг к другу по именам контейнеров из docker-compose.
- **Установка пакетов**: только через фильтр — `pnpm add <pkg> --filter <component>`.
