# @coopenomics/sdk

## Назначение

TypeScript SDK для работы с GraphQL API кооператива. Предоставляет типобезопасный клиент с поддержкой запросов, мутаций, подписок, а также вспомогательные классы для работы с блокчейном, документами и криптографией.

## Структура

```
src/
├── index.ts             — Класс Client — главная точка входа.
│                          Client.create() / Client.New(), login(), Query, Mutation, Subscription
├── classes/             — Вспомогательные классы
│   ├── account.ts       — Account — работа с аккаунтами
│   ├── blockchain.ts    — Blockchain — взаимодействие с EOSIO через @wharfkit/session
│   ├── document.ts      — Document — подписание документов (WIF)
│   ├── crypto.ts        — Crypto — криптографические утилиты
│   ├── vote.ts          — Vote — подписание голосований
│   └── canvas.ts        — Canvas — генерация на canvas
├── mutations/           — GraphQL мутации, сгруппированные по доменам
│   ├── accounts/        — Управление аккаунтами
│   ├── auth/            — Аутентификация (login, refresh, logout)
│   ├── branches/        — Кооперативные участки
│   ├── capital/         — Программы ЦПП (инвестирование, проекты)
│   ├── documents/       — Работа с документами
│   ├── extensions/      — Расширения
│   ├── gateway/         — Платёжный шлюз
│   ├── meet/            — Общие собрания
│   ├── notification/    — Уведомления
│   ├── participants/    — Пайщики
│   ├── paymentMethods/  — Платёжные методы
│   ├── registration/    — Регистрация
│   ├── system/          — Системные операции
│   ├── wallet/          — Кошелёк
│   └── ...
├── queries/             — GraphQL запросы, сгруппированные по доменам
│   ├── accounts/, agenda/, agreements/, blockchain-explorer/
│   ├── branches/, capital/, desktop/, documents/
│   ├── extensions/, gateway/, ledger/, meet/
│   ├── notification/, paymentMethods/
│   ├── registration/, system/, wallet/
│   └── ...
├── selectors/           — GraphQL Zeus селекторы — типобезопасные объекты выборки полей
│   ├── capital/, common/, desktop/, documents/
│   ├── extensions/, gateway/, ledger/, meet/
│   ├── notification/, participants/, registration/
│   ├── system/, wallet/, branches/, agreements/
│   └── ...
├── zeus/                — Авто-сгенерированные GraphQL типы (Zeus codegen)
│   ├── index.ts         — Thunder, Subscription, ZeusScalars, типы
│   └── const.ts         — Константы
├── types/               — TypeScript типы (client, controller, document, blockchain)
└── utils/               — Утилиты (paginationSelector, validateSelector, MakeAllFieldsRequired)
```

## Ключевые концепции

### Zeus Type System

SDK использует **GraphQL Zeus** — генератор типов, дающий полную типобезопасность без рукописных типов. Типы в `zeus/` генерируются из GraphQL-схемы контроллера.

### Паттерн Selector

Селекторы (`selectors/`) определяют, какие поля запрашивать из GraphQL. Каждый селектор:
1. Определяет `raw*Selector` — объект с `true` для каждого поля
2. Валидирует через `MakeAllFieldsRequired<ValueTypes['TypeName']>`
3. Экспортирует финальный селектор через `Selector('TypeName')(rawSelector)`
4. Экспортирует тип модели: `ModelTypes['TypeName']`

### Client

```typescript
const client = Client.create({ api_url: '...', wif: '...', username: '...' })
await client.login(email, wif)

// Запросы и мутации через Zeus с полной типизацией
const result = await client.Query({ ... })
await client.Mutation({ ... })
```

Доступ к подсистемам: `client.Blockchain`, `client.Document`, `client.Crypto`, `client.Vote`, `client.Account`.

### Мутации и запросы

Каждая мутация/запрос экспортирует:
- `name` — имя операции
- `mutation` / `query` — Zeus selector
- `IInput` — интерфейс входных данных
- `IOutput` — интерфейс результата (опционально)

## Скрипты package.json

| Скрипт | Описание |
|--------|----------|
| `build` | Сборка через unbuild (с предварительной проверкой типов) |
| `dev` | Stub-режим unbuild |
| `test` | Vitest (timeout 60s) |
| `lint` | ESLint |
| `typecheck` | TypeScript проверка |
| `docs` | Генерация документации (TypeDoc **0.25.x** + `typedoc-plugin-expand-object-like-types`; 0.28+ несовместим с плагином) |

## Зависимости от других компонентов

- `cooptypes` (workspace) — общие типы
- Зависит от GraphQL-схемы `controller` (для генерации Zeus типов)

## Правила работы с Zeus (подробности)

См. файл `.cursor/rules/sdk.mdc` — детальное руководство по созданию селекторов, валидации типов и структуре запросов/мутаций.

## ГЕНЕРАЦИЯ КЛИЕНТА

Перед генерацией клиента необходимо выполнить команду для генерации схемы в папке компонента controler: `pnpm run generate-schema`. После этого сгенерировать клиента там же в controller `pnpm run generate-client`. После чего обновленные типы graphql станут доступны в zeus и SDK.
