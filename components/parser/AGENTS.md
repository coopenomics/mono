# @coopenomics/parser

## Назначение

Индексатор блокчейна EOSIO через State History Plugin (SHiP). Подключается к WebSocket ноды, получает блоки, действия и дельты таблиц, сохраняет в MongoDB и публикует события в Redis Streams. Предоставляет REST API для чтения данных.

## Структура

```
src/
├── index.ts              — Express-сервер (REST API) + запуск парсера
│                           PORT из переменной окружения, ACTIVATE_PARSER=1 включает парсинг
├── config.ts             — Конфигурация: переменные окружения (API, SHIP, MONGO, REDIS, и т.д.)
│                           subscribedContracts — список контрактов для индексации
├── Reader/
│   └── Reader.ts         — loadReader() — подключение к SHiP WebSocket
│                           Логика START_BLOCK: 1 → старт с HEAD + инициализация,
│                           другое значение → старт с указанного блока
├── Parser/
│   └── index.ts          — Главный Parser класс, оркестрирует все парсеры
├── ActionParser/         — Парсинг действий (транзакций) блокчейна
│   ├── Parser/           — ActionParser — обработка потока действий
│   ├── Factory/          — ActionFactory — маршрутизация действий по обработчикам
│   └── Actions/          — Обработчики действий (any.any.ts — универсальный)
├── DeltaParser/          — Парсинг дельт (изменений таблиц) блокчейна
│   ├── Parser/           — DeltaParser — обработка потока дельт
│   ├── Factory/          — DeltaFactory — маршрутизация дельт по обработчикам
│   └── Deltas/           — Обработчики дельт (any.any.any.ts — универсальный)
├── BlockParser/          — Парсинг блоков (обновление текущего блока в sync)
├── ForkParser/           — Обработка форков цепочки
│   ├── Parser/, Factory/, Forks/
├── Database/
│   └── index.ts          — MongoDB: коллекции actions, deltas, sync
│                           CRUD, пагинация, агрегация по primary_key, очистка
├── Initializer/
│   └── index.ts          — initializeFromBlockchain() — при первом запуске (HEAD)
│                           загружает данные кооператива и шаблоны из блокчейна в MongoDB
├── RedisNotifier/
│   └── index.ts          — Публикация событий в Redis Streams
└── Utils/
    └── Blockchain.ts     — Утилиты для работы с RPC (fetchAbi, getInfo, extractTables)
```

## Ключевые концепции

### Протокол SHiP (State History Plugin)

Парсер подключается к WebSocket-эндпоинту ноды EOSIO. Библиотека `@blockmatic/eosio-ship-reader` управляет подключением и десериализацией.

### Логика START_BLOCK

- `START_BLOCK=1` — при первом запуске стартует с HEAD-блока и выполняет `initializeFromBlockchain()` (загрузка кооператива и шаблонов из RPC). При повторных запусках продолжает с сохранённого блока.
- `START_BLOCK=N` (N>1) — начинает парсинг с блока N (для полного replay).

### subscribedContracts

Список контрактов для индексации определён в `config.ts`:
`draft`, `meet`, `soviet`, `registrator`, `eosio.token`, `capital`, `wallet`, `ledger`

Действия и таблицы этих контрактов автоматически подписываются через ABI.

### Redis Streams

Парсер публикует события в Redis Streams для потребления другими сервисами (controller). Конфигурация через переменные `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`. Parser не обрезает stream; trim делает controller на основе consumer-group consumption (XTRIM MINID по first-pending).

### REST API

- `GET /get-tables` — чтение дельт таблиц (с пагинацией и фильтрацией)
- `GET /get-actions` — чтение действий (с пагинацией и фильтрацией)
- `GET /get-current-block` — текущий обработанный блок

## Переменные окружения

| Переменная | Описание |
|-----------|----------|
| `API` | URL RPC-ноды блокчейна |
| `SHIP` | WebSocket URL ноды (SHiP) |
| `MONGO_EXPLORER_URI` | Строка подключения к MongoDB |
| `START_BLOCK` | Начальный блок (1 = с HEAD) |
| `FINISH_BLOCK` | Конечный блок (макс. значение = бесконечно) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Подключение к Redis |
| `ACTIVATE_PARSER` | 1 = включить парсинг при старте |
| `COOPNAME` | Имя кооператива (для инициализации) |
| `NODE_ENV` | test — добавляет суффикс `-test` к имени БД |
| `PORT` | Порт Express-сервера (по умолчанию 4000) |

## Скрипты package.json

| Скрипт | Описание |
|--------|----------|
| `dev` | Запуск с nodemon (hot-reload) |
| `build` | Сборка через unbuild |
| `lint` | ESLint |
| `test` | Vitest |
| `typecheck` | TypeScript проверка |

## Зависимости от других компонентов

- `cooptypes` (workspace) — имена контрактов, таблиц
