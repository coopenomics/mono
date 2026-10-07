# 🧩 cooptypes

> Общие TypeScript типы и интерфейсы для всей экосистемы «Цифровой Кооператив»

## Описание

Модуль `cooptypes` — центральная библиотека типов, обеспечивающая единый типизированный контракт между всеми компонентами экосистемы COOPENOMICS. Содержит описания действий, таблиц и интерфейсов каждого смарт-контракта блокчейна, модели данных кооператива, реестр шаблонов документов и пользовательские интерфейсы.

Используется как зависимость в компонентах `controller`, `parser`, `desktop`, `sdk`, `factory` и `boot`.

## Возможности

- **Типы контрактов** — полное описание действий (`Actions`) и таблиц (`Tables`) для каждого смарт-контракта: `SovietContract`, `RegistratorContract`, `DraftContract`, `TokenContract`, `CapitalContract`, `WalletContract`, `GatewayContract`, `FundContract`, `LedgerContract`, `MarketContract`, `MeetContract`, `BranchContract` и др.
- **Модели кооператива** — структуры данных для пользователей (`Cooperative.Users`) и реестра документов (`Cooperative.Registry`)
- **Интерфейсы** — типизированные интерфейсы для всех доменов: `Soviet`, `Capital`, `Registrator`, `Wallet`, `Gateway`, `Fund`, `Draft`, `Meet`, `Marketplace`, `Branch`, `Ledger`, `Loan`, `Token`, `System`
- **Реестр шаблонов** — шаблоны юридических документов с markdown-разметкой

## Установка

```bash
pnpm install --filter cooptypes
```

## Скрипты

| Скрипт | Описание |
|--------|----------|
| `pnpm run build` | Сборка библиотеки (`unbuild`) |
| `pnpm run dev` | Режим разработки с автоматической пересборкой (`nodemon`) |
| `pnpm run test` | Запуск тестов (`vitest`) |
| `pnpm run lint` | Проверка кода (`ESLint`) |
| `pnpm run typecheck` | Проверка типов TypeScript (`tsc --noEmit`) |
| `pnpm run docs` | Генерация документации (`TypeDoc`) |

> Все скрипты запускаются из корня монорепозитория через фильтр: `pnpm --filter cooptypes run <скрипт>`

## Архитектура

```
src/
├── contracts/              # Типы смарт-контрактов блокчейна
│   ├── soviet/             # Совет кооператива
│   ├── registrator/        # Регистрация аккаунтов
│   ├── capital/            # Паевые взносы
│   ├── wallet/             # Финансовые операции
│   ├── gateway/            # Платёжный шлюз
│   ├── draft/              # Шаблоны документов
│   ├── fund/               # Фонды кооператива
│   ├── ledger/             # Бухгалтерский учёт
│   ├── marketplace/        # Маркетплейс
│   ├── meet/               # Собрания пайщиков
│   ├── branch/             # Кооперативные участки
│   ├── token/              # Системные токены
│   ├── system/             # Системный контракт
│   ├── msig/               # Мультиподписи
│   ├── wrap/               # Привилегированные действия
│   └── index.ts            # Реэкспорт всех контрактов
├── cooperative/            # Модели данных кооператива
│   ├── users/              # Типы пользователей
│   ├── registry/           # Реестр шаблонов документов
│   └── index.ts
├── interfaces/             # Типизированные интерфейсы по доменам
│   ├── soviet.ts
│   ├── capital.ts
│   ├── registrator.ts
│   ├── wallet.ts
│   ├── gateway.ts
│   ├── fund.ts
│   ├── draft.ts
│   ├── meet.ts
│   ├── marketplace.ts
│   ├── branch.ts
│   ├── ledger.ts
│   ├── debt.ts
│   ├── token.ts
│   ├── system.ts
│   └── index.ts
└── index.ts                # Главная точка входа
```

Каждый контракт экспортирует: `contractName` (имя аккаунта контракта), `Actions` (действия с интерфейсами и авторизацией), `Tables` (таблицы с интерфейсами и scope).

## Конфигурация

Дополнительная конфигурация не требуется. Модуль является чистой библиотекой типов без внешних зависимостей на рантайм-сервисы.

## Тестирование

```bash
pnpm --filter cooptypes run test
```

## Лицензия

[BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.ru)
