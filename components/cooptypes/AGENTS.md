# cooptypes

## Назначение

Общая библиотека TypeScript-типов экосистемы кооперативов. Содержит интерфейсы для всех смарт-контрактов блокчейна, модели данных кооперативов, интерфейсы документов и реестр шаблонов документов с Markdown-шаблонами.

## Структура

```
src/
├── index.ts             — Главный экспорт: _Common, contracts, Cooperative, Interfaces
├── contracts/           — Типы для каждого смарт-контракта
│   ├── index.ts         — Экспорт всех контрактов
│   ├── draft/           — DraftContract: шаблоны документов
│   ├── registrator/     — RegistratorContract: аккаунты и кооперативы
│   ├── soviet/          — SovietContract: советы и решения
│   ├── gateway/         — GatewayContract: платёжный шлюз
│   ├── token/           — TokenContract: токены
│   ├── wallet/          — WalletContract: кошельки и взносы
│   ├── capital/         — CapitalContract: интеллектуальная капитализация
│   ├── fund/            — FundContract: фонды
│   ├── branch/          — BranchContract: кооперативные участки
│   ├── marketplace/     — MarketContract: маркетплейс
│   ├── ledger/          — LedgerContract: бухгалтерская книга
│   ├── meet/            — MeetContract: общие собрания
│   ├── debt/            — DebtContract: беспроцентные займы
│   ├── system/          — SystemContract: системные операции
│   ├── msig/            — MsigContract: мульти-подписи
│   └── wrap/            — WrapContract: привилегированные действия
├── cooperative/
│   ├── users/           — IIndividualData, IOrganizationData, IEntrepreneurData
│   ├── registry/        — Реестр шаблонов документов с Markdown-шаблонами
│   │   ├── index.ts     — Экспорт всех шаблонов по registry_id
│   │   └── <id>.<Name>/ — Каждая директория = один шаблон
│   │       ├── index.ts — Метаданные (title, description, context, model, translations)
│   │       └── template.md — Markdown-шаблон (не у всех)
│   ├── payments/        — Типы платёжных методов
│   └── Model.ts         — IVars, основная модель кооператива
├── interfaces/          — Общие интерфейсы системы
│   ├── index.ts         — Экспорт всех интерфейсов
│   ├── branch.ts, capital.ts, draft.ts, fund.ts
│   ├── gateway.ts, ledger.ts, debt.ts, marketplace.ts
│   ├── meet.ts, msig.ts, registrator.ts, soviet.ts
│   ├── system.ts, token.ts, wallet.ts, wrap.ts
│   └── ...
└── common/              — Общие утилитарные типы
```

## Ключевые концепции

### Именование контрактов

Каждый контракт экспортирует `contractName` с вариантами для разных сетей:
```typescript
SovietContract.contractName.production // → 'soviet'
```

### Структура контракта

Каждый контракт содержит:
- **Tables** — интерфейсы таблиц блокчейна (имя таблицы + тип строки)
- **Actions** — интерфейсы действий (параметры + авторизация)

Пример:
```typescript
RegistratorContract.Tables.Cooperatives.tableName // → 'coops'
RegistratorContract.Tables.Cooperatives.ICooperative // интерфейс строки

SovietContract.Actions.Decisions.VoteFor.IVoteForDecision // интерфейс параметров действия
```

### Реестр шаблонов (cooperative/registry/)

Каждый шаблон (по `registry_id`) содержит:
- `title` — название документа
- `description` — описание
- `context` — контекст (statement, decision, act, и т.д.)
- `model` — JSON-модель данных для генерации
- `translations` — переводы (обычно `{ ru: {...} }`)
- Опционально: `template.md` — Markdown-шаблон с Handlebars-плейсхолдерами

### IDocument

Базовый интерфейс документа блокчейна: `version`, `hash`, `doc_hash`, `meta_hash`, `meta`, `signatures`.

## Скрипты package.json

| Скрипт | Описание |
|--------|----------|
| `build` | Сборка через unbuild |
| `dev` | Пересборка при изменениях (nodemon + unbuild) |
| `test` | Vitest |
| `lint` | ESLint |
| `typecheck` | TypeScript проверка |

## Зависимости

Нет workspace-зависимостей. Это базовый пакет, от которого зависят все остальные компоненты.
