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
│   ├── loan/            — LoanContract: займы
│   ├── system/          — SystemContract: системные операции
│   ├── msig/            — MsigContract: мульти-подписи
│   └── wrap/            — WrapContract: привилегированные действия
├── cooperative/
│   ├── document/        — документ в цепи: подписи, хэши, канонизация меты
│   └── blockchain/      — действия и таблицы из журнала цепи
├── interfaces/          — Общие интерфейсы системы
│   ├── index.ts         — Экспорт всех интерфейсов
│   ├── branch.ts, capital.ts, draft.ts, fund.ts
│   ├── gateway.ts, ledger.ts, loan.ts, marketplace.ts
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

### Шаблоны документов — в `@coopenomics/docs-templates`

Реестр шаблонов (`registry_id`, текст, схема `model`, переводы, типы `Action` и
`Model`), реестр решений совета для робота, модель документа (мета, вход
сборщика, собранный документ, виды утверждения), данные кооператива (`IVars`,
`UdataKey`), субъекты и реквизиты перенесены 30.10.2026 в пакет
`@coopenomics/docs-templates` (репозиторий C9S/docs-factory, шаг 6б фабрики v2).
В `cooptypes` остаются типы цепи, в том числе документ в цепи
(`Cooperative.Document`: `IChainDocument2`, `ISignedDocument2`, `SigFile`) —
мету документа он берёт из пакета шаблонов.

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
