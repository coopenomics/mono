# Архитектура Системы Документов

## Общее описание

Система документов кооператива построена на гибридной архитектуре, объединяющей блокчейн (распределённый реестр) и приватную базу данных MongoDB. Блокчейн хранит неизменяемые записи о подписанных документах с анонимизированными данными, а MongoDB содержит приватные данные для деанонимизации и полные тексты документов.

## Источники данных

### Блокчейн (Simple Explorer API)

Блокчейн хранит действия (actions) смарт-контракта `soviet`, которые фиксируют факты работы с документами:

| Действие | Описание |
|----------|----------|
| `newsubmitted` | Входящий пакет документов, ожидающий утверждения |
| `newresolved` | Утверждённый пакет документов после завершения бизнес-логики |
| `newdecision` | Протокол решения совета кооператива |
| `newact` | Акт (например, акт приёма-передачи) |
| `newagreement` | Связанное соглашение |
| `newlink` | Связанный документ |

#### Структура блокчейн-действия

```typescript
interface IAction {
  block_num: number;
  transaction_id: string;
  account: string;           // 'soviet'
  name: string;              // 'newsubmitted' | 'newresolved' | ...
  receiver: string;          // имя кооператива
  data: {
    coopname: string;        // имя кооператива
    username: string;        // имя пользователя
    action: string;          // тип действия ('regcoop', 'joincoop', ...)
    package: string;         // идентификатор пакета документов (SHA-256)
    document: {
      version: string;       // версия формата документа
      hash: string;          // общий хеш
      doc_hash: string;      // хеш содержимого документа
      meta_hash: string;     // хеш метаданных
      meta: string;          // JSON-строка метаданных
      signatures: ISignature[];
    }
  }
}
```

### MongoDB (Приватная база данных)

MongoDB хранит:
- Полные тексты документов (PDF, HTML)
- Приватные данные пользователей (ФИО, паспортные данные, адреса)
- Данные организаций и ИП

Документы извлекаются по `doc_hash` из блокчейн-записи.

## Жизненный цикл документа

### 1. Подача заявления (newsubmitted)

Когда пользователь подаёт заявление (регистрация в кооперативе, взнос, и т.д.):

1. Документ генерируется и сохраняется в MongoDB
2. Хеш документа и подпись фиксируются в блокчейне через действие `newsubmitted`
3. Документ получает уникальный `package` идентификатор

### 2. Принятие решения (newresolved)

После прохождения бизнес-логики (решение совета, подписание актов):

1. Действие `newresolved` фиксируется в блокчейне с тем же `package`
2. Связанные действия (`newdecision`, `newact`) ссылаются на этот `package`
3. Пакет документов считается полностью завершённым

## Архитектура агрегации

### Слои архитектуры

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                            │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │  DocumentResolver    │  │  GetDocumentsInputDTO           │  │
│  │  (GraphQL)           │  │  - username, filter, type       │  │
│  └──────────────────────┘  │  - after_block, before_block    │  │
│            │               │  - actions (фильтр по действиям)│  │
│            ▼               └─────────────────────────────────┘  │
│  ┌──────────────────────┐                                       │
│  │  DocumentService     │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Domain Layer                                  │
│  ┌──────────────────────┐                                       │
│  │DocumentDomainInteract│ ◄── GetDocumentsInputDomainInterface  │
│  └──────────────────────┘                                       │
│            │                                                     │
│            ▼                                                     │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │DocumentDomainService │  │  DocumentPackageAggregator      │  │
│  │                      │  │  ├── DocumentPackageV0Aggregator│  │
│  │  - generateDocument  │  │  └── DocumentPackageV1Aggregator│  │
│  │  - getImmutableSigned│  └─────────────────────────────────┘  │
│  └──────────────────────┘                                       │
│            │                         │                           │
│            ▼                         ▼                           │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Simple Explorer API │  │  DocumentAggregator             │  │
│  │  (Блокчейн данные)   │  │  (Сборка агрегата документа)    │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                             │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │  DocumentRepository  │  │  GeneratorInfrastructureService │  │
│  │  (MongoDB)           │  │  (Генерация PDF)                │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Агрегат пакета документов (DocumentPackageAggregate)

Пакет документов агрегирует все связанные документы:

```typescript
interface DocumentPackageAggregateDomainInterface {
  statement: StatementDetailAggregateDomainInterface | null;  // Заявление
  decision: DecisionDetailAggregateDomainInterface | null;    // Решение совета
  acts: ActDetailAggregateDomainInterface[];                  // Акты
  links: DocumentAggregateDomainInterface[];                  // Связанные документы
}
```

### Детали заявления (StatementDetail)

```typescript
interface StatementDetailAggregateDomainInterface {
  action: ExtendedBlockchainActionDomainInterface;  // Блокчейн-действие
  documentAggregate: DocumentAggregateDomainInterface;  // Агрегат документа
}
```

### Агрегат документа (DocumentAggregate)

```typescript
interface DocumentAggregateDomainInterface {
  hash: string;
  signedDocument: ExtendedSignedDocumentDomainInterface;  // Подписанный документ
  fullDocument: DocumentDomainEntity;  // Полный документ из MongoDB
}
```

## Процесс агрегации

### 1. Запрос документов

```typescript
// GraphQL Query
query {
  getDocuments(data: {
    username: "cooperative1"
    type: "newsubmitted"
    actions: ["regcoop", "joincoop"]
    after_block: 100
    before_block: 500
  }) {
    items { ... }
    totalCount
  }
}
```

### 2. Формирование фильтра

```typescript
// DocumentDomainInteractor
const blockFilters = {
  receiver: username,
  block_num: { $gte: after_block, $lte: before_block },
  'data.action': { $in: actions }  // Фильтр по типам действий
};
```

### 3. Запрос к блокчейну

```typescript
// getActions -> Simple Explorer API
GET /get-actions?filter={
  "account": "soviet",
  "name": "newsubmitted",
  "receiver": "cooperative1",
  "data.action": { "$in": ["regcoop", "joincoop"] },
  "block_num": { "$gte": 100, "$lte": 500 }
}
```

### 4. Агрегация данных

Для каждого блокчейн-действия:

1. **Определение версии документа** (v0 или v1+)
2. **Получение заявления (Statement)**:
   - Извлечение документа из MongoDB по `doc_hash`
   - Получение данных подписанта из приватной базы
   - Создание сертификата пользователя
3. **Получение решения (Decision)**:
   - Поиск `newdecision` по `package`
   - Извлечение документа решения
4. **Получение актов (Acts)**:
   - Поиск всех `newact` по `package`
   - Извлечение документов актов
5. **Получение связанных документов (Links)**:
   - Поиск `newlink` и `newagreement`
   - Обработка ссылок в метаданных документов

## Типы действий (data.action)

Типы действий определены в enum `DocumentAction`:

```typescript
export enum DocumentAction {
  REGCOOP = 'regcoop',      // Регистрация кооператива
  JOINCOOP = 'joincoop',    // Вступление в кооператив
  CONTRIBUTE = 'contribute', // Взнос в кооператив
  WITHDRAW = 'withdraw',    // Выход из кооператива
  // Другие действия могут быть добавлены по мере необходимости
}
```

| Действие | Описание |
|----------|----------|
| `REGCOOP` | Регистрация кооператива |
| `JOINCOOP` | Вступление в кооператив |
| `CONTRIBUTE` | Взнос в кооператив |
| `WITHDRAW` | Выход из кооператива |

## Версионирование документов

### Версия 0 (Legacy)

Старый формат без поля `version` в документе. Обрабатывается `DocumentPackageV0Aggregator`.

### Версия 1+

Новый формат с явным полем `version`. Обрабатывается `DocumentPackageV1Aggregator`.

```typescript
// Определение версии
const docVersion = rawAction.data?.document?.version ?? '0';
```

## Хеширование и подписи

### Типы хешей

| Хеш | Описание |
|-----|----------|
| `hash` | Общий хеш документа |
| `doc_hash` | Хеш содержимого документа (используется для извлечения из MongoDB) |
| `meta_hash` | Хеш метаданных |

### Уникальность `doc_hash` и дата в мете

`doc_hash` — sha256 файла документа, и по нему черновик находится в MongoDB.
Правило: **одинаковый `doc_hash` бывает только у одинаковых документов** —
с одним телом и одной метой. Поэтому:

- `meta.created_at` — момент генерации в ISO 8601, UTC, до миллисекунд
  (`2026-09-24T11:05:31.123Z`). Вид для человека («ДД.ММ.ГГГГ ЧЧ:ММ» в поясе
  `meta.timezone`) собирает рендер, шаблон выводит его переменной `{{ created_at }}`.
  Мета вида для человека не хранит.
- В свойства файла (у PDF — Keywords) фабрика вписывает отпечаток меты
  `meta:<documentMetaKey(meta)>`. Тело двух генераций одного документа совпадает,
  мета — нет, и отпечаток разводит их хэши.
- Отпечаток выводится из самой меты: перегенерация из той же меты даёт тот же
  файл и тот же `doc_hash` (проверка документа перегенерацией в кабинете).

Документы до 28.09.2026 хранят в `meta.created_at` дату «ДД.ММ.ГГГГ ЧЧ:ММ» и
собраны без отпечатка. Фабрика разбирает оба вида даты и собирает такие документы
по-старому, байт в байт. Причина правила — C28-84: дата до минуты давала двум
генерациям одного заявления один `doc_hash`, сверка брала чужой черновик, и
повторная подпись отбивалась как подмена.

### Структура подписи

```typescript
interface ISignature {
  id: number;
  signed_hash: string;
  signer: string;          // username подписанта
  public_key: string;
  signature: string;
  signed_at: string;
  meta: string;
}
```

## Фильтрация и пагинация

### Доступные фильтры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `type` | `'newsubmitted' \| 'newresolved'` | Тип действия (входящие/утверждённые) |
| `username` | `string` | Имя пользователя (receiver) |
| `filter` | `Record<string, unknown>` | Произвольный MongoDB-фильтр |
| `actions` | `DocumentAction[]` | Массив типов действий для фильтрации |
| `after_block` | `number` | Блок начала диапазона |
| `before_block` | `number` | Блок конца диапазона |
| `page` | `number` | Номер страницы |
| `limit` | `number` | Количество записей на странице |

### Пример использования фильтра actions

```typescript
import { DocumentAction } from '~/domain/document/enums/document-action.enum';

// В коде:
const actions = [DocumentAction.REGCOOP, DocumentAction.JOINCOOP];
```

```graphql
query {
  getDocuments(data: {
    username: "cooperative1"
    type: "newsubmitted"
    actions: ["regcoop"]  # Только документы регистрации кооператива
    filter: {}
  }) {
    items {
      statement {
        action {
          name
          data
        }
        documentAggregate {
          hash
        }
      }
    }
    totalCount
  }
}
```

## Деанонимизация данных

Процесс деанонимизации происходит на этапе агрегации:

1. **Извлечение username** из блокчейн-действия
2. **Запрос приватных данных** из MongoDB через `AccountDomainService`
3. **Создание сертификата** пользователя через `UserCertificateDomainService`
4. **Прикрепление сертификата** к `ExtendedBlockchainActionDomainInterface`

```typescript
const account = await this.accountDomainService.getPrivateAccount(rawData.username);
const actor_certificate = this.userCertificateService.createCertificateFromUserData(account);
```

## Связанные файлы

### Application Layer
- `src/application/document/dto/get-documents-input.dto.ts`
- `src/application/document/services/document.service.ts`
- `src/application/document/resolvers/document.resolver.ts`

### Domain Layer
- `src/domain/document/interactors/document.interactor.ts`
- `src/domain/document/services/document-domain.service.ts`
- `src/domain/document/aggregators/document-package.aggregator.ts`
- `src/domain/document/aggregators/document-package-v1.aggregator.ts`
- `src/domain/document/aggregators/document.aggregator.ts`

### Enums
- `src/domain/document/enums/document-action.enum.ts`

### Interfaces
- `src/domain/document/interfaces/document-package-aggregate-domain.interface.ts`
- `src/domain/document/interfaces/statement-detail-aggregate-domain.interface.ts`
- `src/domain/document/interfaces/decision-detail-aggregate-domain.interface.ts`
- `src/domain/document/interfaces/get-documents-input-domain.interface.ts`

## Известные особенности и TODO

1. **Путаница hash/doc_hash**: В некоторых местах используется `hash`, в других `doc_hash`. Требуется унификация.

2. **Версионирование агрегаторов**: Существуют V0 и V1 агрегаторы. V0 — legacy, требует миграции.

3. **Производительность**: Агрегация делает множество последовательных запросов к API и MongoDB. Возможна оптимизация через batch-запросы.

4. **Валидация подписей**: Подписи валидируются через `Classes.Document.validateSignature()`, но результат не всегда используется для бизнес-логики.

5. **Миграция в PostgresQL**: предстоит миграция из MongoDB в postgres.
