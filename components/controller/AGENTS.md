# AGENTS.md — @coopenomics/controller

Основной бэкенд-сервис платформы «Цифровой Кооператив». NestJS GraphQL API с чистой архитектурой.

---

## Оглавление

- [Обзор архитектуры](#обзор-архитектуры)
- [Дерево директорий](#дерево-директорий)
- [Чистая архитектура — слои](#чистая-архитектура--слои)
- [Доменный слой (domain/)](#доменный-слой-domain)
- [Инфраструктурный слой (infrastructure/)](#инфраструктурный-слой-infrastructure)
- [Прикладной слой (application/)](#прикладной-слой-application)
- [Система расширений (extensions/)](#система-расширений-extensions)
- [Описание каждого расширения](#описание-каждого-расширения)
- [GraphQL API](#graphql-api)
- [Аутентификация и авторизация](#аутентификация-и-авторизация)
- [Блокчейн-взаимодействие](#блокчейн-взаимодействие)
- [Генерация документов](#генерация-документов)
- [База данных](#база-данных)
- [Платёжный шлюз](#платёжный-шлюз)
- [Конфигурация](#конфигурация)
- [Ключевые зависимости](#ключевые-зависимости)

---

## Обзор архитектуры

Проект построен по принципам **чистой архитектуры (Clean Architecture)** с тремя основными слоями:

```
Резолвер (GraphQL) → Сервис (application) → Интерактор (domain) → Порт (domain) → Адаптер (infrastructure)
```

Направление зависимостей — **внутрь, к домену**. Домен не зависит от инфраструктуры. Слои связываются через `AppModule` (`src/app.module.ts`) — не нужно импортировать их друг в друга напрямую.

Точка входа: `src/index.ts` — создаёт NestJS-приложение поверх Express, подключает MongoDB (Mongoose), запускает миграции и слушает порт.

---

## Дерево директорий

```
src/
├── app.module.ts              # Корневой модуль — собирает все слои
├── index.ts                   # Точка входа (bootstrap)
├── app.ts                     # Express-приложение (middleware)
│
├── config/                    # Конфигурация
│   ├── config.ts              # Zod-валидация env-переменных, экспорт config-объекта
│   ├── logger.ts              # Конфигурация Winston-логгера
│   └── morgan.ts              # HTTP-логирование
│
├── domain/                    # 🟢 Доменный слой (бизнес-логика)
│   ├── account/               #   Аккаунты пользователей
│   ├── agenda/                #   Повестки собраний
│   ├── agreement/             #   Соглашения кооператива
│   ├── auth/                  #   Доменная логика аутентификации
│   ├── blockchain/            #   Типы блокчейна
│   ├── branch/                #   Кооперативные участки
│   ├── common/                #   Общие порты, репозитории, value-objects
│   ├── cooplace/              #   Маркетплейс (кооперативная площадка)
│   ├── decision-tracking/     #   Отслеживание решений совета
│   ├── desktop/               #   Рабочие столы
│   ├── document/              #   Документооборот (агрегаты, агрегаторы, порты)
│   ├── extension/             #   Система расширений (сущности, сервисы, репозитории)
│   ├── free-decision/         #   Свободные решения совета
│   ├── gateway/               #   Платёжный шлюз (провайдеры, порты, сущности)
│   ├── ledger/                #   Бухгалтерский учёт
│   ├── meet/                  #   Общие собрания (агрегаты, голосования)
│   ├── mutation-log/          #   Логирование мутаций
│   ├── notification/          #   Уведомления
│   ├── parser/                #   Парсинг блокчейн-данных
│   ├── participant/           #   Пайщики кооператива
│   ├── payment-method/        #   Платёжные методы
│   ├── registration/          #   Регистрация пайщиков
│   ├── settings/              #   Системные настройки
│   ├── system/                #   Системное управление
│   ├── token/                 #   Токены (refresh/access)
│   ├── user/                  #   Пользователи
│   ├── vault/                 #   Хранилище ключей
│   └── wallet/                #   Кошельки пайщиков
│
├── infrastructure/            # 🔵 Инфраструктурный слой (адаптеры)
│   ├── blockchain/            #   Адаптер блокчейна EOSIO (wharfkit)
│   │   ├── adapters/          #     Конкретные адаптеры (account, branch, gateway, meet, ...)
│   │   ├── services/          #     Вспомогательные сервисы блокчейна
│   │   └── blockchain.service.ts  # Основной сервис (реализует BlockchainPort)
│   ├── database/              #   Адаптеры БД
│   │   ├── typeorm/           #     PG (реляционная БД) через TypeORM
│   │   │   ├── entities/      #       TypeORM-сущности (~23 таблицы)
│   │   │   ├── repositories/  #       Реализации репозиториев
│   │   │   ├── mappers/       #       Мапперы блокчейн-дельт
│   │   │   └── services/      #       Сервисы синхронизации
│   │   └── generator-repositories/  # Репозитории для Generator (MongoDB)
│   ├── graphql/               #   Конфигурация GraphQL (Apollo, директивы, фильтры)
│   ├── redis/                 #   Redis-адаптер (pub/sub, кэш)
│   ├── novu/                  #   Интеграция с Novu (уведомления)
│   ├── events/                #   Шина событий (EventEmitter)
│   ├── vault/                 #   Хранение приватных ключей
│   ├── gateway/               #   Инфраструктура платёжного шлюза
│   ├── account/               #   Инфраструктура аккаунтов
│   ├── document/              #   Инфраструктура документов
│   ├── generator/             #   Генератор документов (обёртка над @coopenomics/factory)
│   ├── registration/          #   Инфраструктура регистрации
│   ├── meet/                  #   Инфраструктура собраний
│   ├── settings/              #   Инфраструктура настроек
│   ├── system/                #   Системная инфраструктура
│   ├── user/                  #   Инфраструктура пользователей
│   ├── wallet/                #   Инфраструктура кошельков
│   ├── free-decision/         #   Инфраструктура свободных решений
│   ├── decision-tracking/     #   Инфраструктура отслеживания решений
│   ├── payment-method/        #   Инфраструктура платёжных методов
│   └── di/                    #   Вспомогательные DI-модули
│
├── application/               # 🟡 Прикладной слой (NestJS-модули)
│   ├── account/               #   Модуль аккаунтов
│   ├── agenda/                #   Модуль повесток
│   ├── agreement/             #   Модуль соглашений
│   ├── appstore/              #   Магазин расширений (CRUD расширений)
│   ├── auth/                  #   Аутентификация (JWT, guards, strategies)
│   ├── blockchain-explorer/   #   Обозреватель блокчейна
│   ├── branch/                #   Кооперативные участки
│   ├── common/                #   Общие элементы (interceptors, dto)
│   ├── cooplace/              #   Маркетплейс
│   ├── desktop/               #   Рабочие столы
│   ├── document/              #   Документооборот
│   ├── free-decision/         #   Свободные решения
│   ├── gateway/               #   Платёжный шлюз (контроллеры IPN, резолверы)
│   ├── ledger/                #   Бухгалтерский учёт
│   ├── logger/                #   Логирование (Winston)
│   ├── meet/                  #   Общие собрания
│   ├── notification/          #   Уведомления (web-push, Novu)
│   ├── participant/           #   Управление пайщиками
│   ├── payment-method/        #   Платёжные методы
│   ├── provider/              #   Провайдер-аккаунт
│   ├── queue/                 #   Очереди задач (Bull + Redis)
│   ├── redis/                 #   Redis application-модуль
│   ├── registration/          #   Регистрация пайщиков
│   ├── settings/              #   Настройки кооператива
│   ├── system/                #   Системный модуль (инициализация, статус)
│   ├── token/                 #   Токены авторизации
│   ├── user/                  #   Пользователи
│   └── wallet/                #   Кошельки
│
├── extensions/                # 🟣 Система расширений (плагины)
│   ├── base.extension.module.ts   # Абстрактный базовый класс расширения
│   ├── extensions.module.ts       # Динамический модуль регистрации всех расширений
│   ├── extensions.registry.ts     # Реестр расширений (AppRegistry)
│   ├── builtin/               #   Встроенное расширение-заглушка
│   ├── chairman/              #   Стол Председателя
│   ├── capital/               #   Благорост (целевая программа)
│   ├── chatcoop/              #   Стол связи (Matrix, звонки, транскрипция)
│   ├── participant/           #   Стол Пайщика (уведомления, трекер собраний)
│   ├── powerup/               #   Вычислительные ресурсы (блокчейн powerup)
│   ├── yookassa/              #   Платёжный провайдер ЮKassa
│   ├── sberpoll/              #   Автоматический приём через Сбербанк
│   ├── qrpay/                 #   QR-оплата через банк
│   ├── 1ccoop/                #   Интеграция с 1С
│   └── orders/ (заглушка)     #   Стол заказов (в разработке)
│
├── shared/                    # Общие утилиты и абстракции
│   ├── utils/                 #   Утилиты (domain-to-blockchain, payments)
│   ├── sync/                  #   Версионирование сущностей (для форков блокчейна)
│   ├── dto/                   #   Общие DTO
│   └── interfaces/            #   Общие интерфейсы
│
├── migrator/                  # Система миграций данных
├── routes/                    # REST-маршруты (v1)
├── scripts/                   # Утилитные скрипты
├── types/                     # Общие TypeScript-типы
└── utils/                     # Утилиты (HttpApiError и пр.)
```

---

## Чистая архитектура — слои

### Поток данных

```
GraphQL-запрос
  → Резолвер (application)       : принимает DTO, вызывает сервис
    → Сервис (application)       : оркестрирует, передаёт DTO в интерактор
      → Интерактор (domain)      : бизнес-логика, работает с портами
        → Порт (domain, interface): абстрактный контракт
          → Адаптер (infrastructure): конкретная реализация (БД, блокчейн, API)
  ← Результат возвращается обратно по цепочке
```

### Правила зависимостей

1. **Домен** не зависит от инфраструктуры и application. Не импортирует `cooptypes` (инфраструктурный контракт).
2. **Инфраструктура** реализует доменные порты. Преобразование типов (Date → string, JSON и т.д.) — **только здесь**.
3. **Application** импортирует доменные интерфейсы. DTO имплементируют доменные интерфейсы напрямую.
4. Связь между слоями — через **NestJS DI** (токены `Symbol`), регистрация в `app.module.ts`.

### Типичная структура модуля (application)

```
application/account/
├── dto/           # GraphQL Input/Object типы, имплементируют доменные интерфейсы
├── resolvers/     # GraphQL-резолверы (@Query, @Mutation)
├── services/      # Оркестрация вызовов интеракторов
├── interactors/   # Бизнес-логика на уровне приложения
└── account.module.ts
```

---

## Доменный слой (domain/)

Каждый домен содержит:
- `entities/` — доменные сущности (чистые классы без зависимостей от фреймворков)
- `interfaces/` — доменные интерфейсы (контракты для DTO и сущностей)
- `ports/` — абстрактные интерфейсы для внешних взаимодействий (БД, блокчейн)
- `repositories/` — абстрактные репозитории (символы + интерфейсы)
- `services/` — доменные сервисы
- `enums/` — перечисления

### Ключевые домены

| Домен | Назначение |
|-------|-----------|
| `account` | Аккаунты в блокчейне и системе провайдера. Сущность `AccountDomainEntity` — агрегат из blockchain_account, participant_account, provider_account, user_account |
| `agreement` | Соглашения кооператива (пользовательское, о подписи, о кошельке, приватности). Синхронизируются из блокчейна через `AgreementSyncService` |
| `auth` | JWT-аутентификация. `AuthDomainService` — генерация/валидация токенов |
| `branch` | Кооперативные участки. `BranchBlockchainPort` — чтение из блокчейна |
| `document` | Электронный документооборот. `DocumentDomainAggregate` — связывает хэш, подписанный документ и raw-документ. `GeneratorPort` — генерация PDF. `DocumentDataPort` — хранение |
| `extension` | Расширения. `ExtensionDomainEntity<TConfig>` — сущность с конфигурацией. `ExtensionDomainService` — CRUD, дефолтные приложения |
| `gateway` | Платёжный шлюз. `PaymentProviderPort` — абстракция провайдера (createPayment). `ProviderDomainService` — реестр провайдеров. `GatewayExpiryCronService` — автоматическая экспирация |
| `meet` | Общие собрания. Агрегаты: `MeetDomainAggregate` (собрание с вопросами повестки). `MeetBlockchainPort` — взаимодействие с контрактом `soviet` |
| `participant` | Пайщики кооператива — данные из блокчейна |
| `registration` | Регистрация новых пайщиков — workflow с этапами |
| `user` | Пользователи системы (реляционная БД). `UserDomainEntity` — id, username, email, role, public_key |
| `vault` | Хранилище приватных ключей (шифрованные WIF) |
| `wallet` | Кошельки пайщиков — балансы и программы |
| `ledger` | Бухгалтерские операции — входящие/исходящие транзакции |
| `cooplace` | Маркетплейс — товары, обмены, заказы через блокчейн |
| `parser` | Парсинг блокчейн-данных: actions, deltas, forks, sync states |
| `notification` | Уведомления — web-push подписки |
| `token` | Refresh/access токены — хранение в реляционной БД |
| `settings` | Настройки кооператива — key/value хранилище |
| `mutation-log` | Логирование всех GraphQL-мутаций |

### Общие порты (domain/common/ports/)

| Порт | Назначение |
|------|-----------|
| `BlockchainPort` | Базовый порт блокчейна (transact, getInfo, getAccount, getSingleRow, getAllRows, query) |
| `SovietBlockchainPort` | Порт для контракта `soviet` (решения совета) |
| `RedisPort` | Pub/Sub и кэш |
| `UdataDocumentParametersPort` | Параметры документов |

---

## Инфраструктурный слой (infrastructure/)

### Блокчейн (infrastructure/blockchain/)

`BlockchainService` — основная реализация `BlockchainPort`:
- Использует `@wharfkit/antelope`, `@wharfkit/session`, `@wharfkit/contract`
- Подключается к EOSIO-ноде через `config.blockchain.url`
- `initialize(username, wif)` — создаёт сессию для транзакций
- `transact(actions)` — отправка транзакций
- `getSingleRow/getAllRows/query` — чтение таблиц смарт-контрактов

**Блокчейн-адаптеры** (`infrastructure/blockchain/adapters/`):

| Адаптер | Порт | Контракт |
|---------|------|----------|
| `AccountBlockchainAdapter` | `ACCOUNT_BLOCKCHAIN_PORT` | `registrator` |
| `BranchBlockchainAdapter` | `BRANCH_BLOCKCHAIN_PORT` | `soviet` |
| `SystemBlockchainAdapter` | `SYSTEM_BLOCKCHAIN_PORT` | `registrator`, `soviet` |
| `SovietBlockchainAdapter` | `SOVIET_BLOCKCHAIN_PORT` | `soviet` |
| `CooplaceBlockchainAdapter` | `COOPLACE_BLOCKCHAIN_PORT` | `marketplace` |
| `MeetBlockchainAdapter` | `MEET_BLOCKCHAIN_PORT` | `soviet` (собрания) |
| `GatewayBlockchainAdapter` | `GATEWAY_BLOCKCHAIN_PORT` | `gateway` |
| `WalletBlockchainAdapter` | `WALLET_BLOCKCHAIN_PORT` | `soviet`, `fund` |
| `LedgerBlockchainAdapter` | `LEDGER_BLOCKCHAIN_PORT` | `fund` |

Каждый адаптер преобразует доменные объекты в формат блокчейна (JSON-сериализация, даты → строки) с помощью `DomainToBlockchainUtils`.

### База данных (infrastructure/database/)

**Реляционная БД (TypeORM, PG)**:
- Конфигурация: `typeorm.module.ts`, `ormconfig.ts`
- `synchronize: true` — автоматическая синхронизация схемы (временно)
- Сущности загружаются из `src/infrastructure/**/entities/`, `src/extensions/**/entities/`, `src/shared/**/entities/`

**TypeORM-сущности** (23+ таблиц):

| Сущность | Таблица | Назначение |
|----------|---------|-----------|
| `ExtensionEntity` | extensions | Расширения (конфигурация, состояние) |
| `LogExtensionEntity` | log_extensions | Логи расширений |
| `PaymentEntity` | payments | Платежи шлюза |
| `PaymentStateEntity` | payment_states | Состояния платежей |
| `IpnEntity` | ipns | IPN-уведомления от провайдеров |
| `CandidateEntity` | candidates | Кандидаты на вступление |
| `MeetPreEntity` | meet_pre | Подготовленные собрания |
| `MeetProcessedEntity` | meet_processed | Обработанные собрания |
| `MigrationEntity` | migrations | Миграции данных |
| `WebPushSubscriptionEntity` | web_push_subscriptions | Push-подписки |
| `LedgerOperationEntity` | ledger_operations | Бухгалтерские операции |
| `AgreementTypeormEntity` | agreements | Соглашения |
| `ActionEntity` | actions | Блокчейн-действия (парсер) |
| `DeltaEntity` | deltas | Блокчейн-дельты (парсер) |
| `ForkEntity` | forks | Форки блокчейна |
| `SyncStateEntity` | sync_states | Состояние синхронизации |
| `EntityVersionTypeormEntity` | entity_versions | Версионирование сущностей |
| `SettingsEntity` | settings | Настройки |
| `TokenEntity` | tokens | JWT-токены |
| `UserEntity` | users | Пользователи |
| `VaultEntity` | vault | Хранилище ключей |
| `SystemStatusEntity` | system_status | Статус системы |
| `MutationLogEntity` | mutation_logs | Логи мутаций |
| `ProgramWalletTypeormEntity` | program_wallets | Программные кошельки |

**MongoDB (Mongoose)**:
- Подключается через `MongooseModule.forRoot(config.mongoose.url)`
- Используется для:
  - Хранения и генерации документов (`@coopenomics/factory`)
  - Хранения переменных кооператива (`vars`)
  - Генератор-репозитории (`generator-repositories/`)

**DI-паттерн для репозиториев**:
```typescript
// Доменный порт (символ + интерфейс)
export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');
export interface PaymentRepository { ... }

// Инфраструктурная реализация
@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository { ... }

// Регистрация в модуле
{ provide: PAYMENT_REPOSITORY, useClass: TypeOrmPaymentRepository }
```

### Генератор документов (infrastructure/generator/)

`GeneratorInfrastructureService` — обёртка над `@coopenomics/factory`:
- `generate(data, options)` → генерация PDF-документа
- `constructCooperative(username)` → построение модели кооператива
- `search(query)` → поиск документов
- Подключается к MongoDB при инициализации модуля

---

## Прикладной слой (application/)

### Структура модуля

Каждый модуль в `application/` содержит:
- `dto/` — GraphQL типы (`@InputType`, `@ObjectType`), имплементируют доменные интерфейсы
- `resolvers/` — GraphQL-резолверы (`@Resolver`, `@Query`, `@Mutation`)
- `services/` — оркестрация (связь между резолверами и доменными интеракторами)
- `interactors/` или `use-cases/` — бизнес-логика на уровне приложения
- `*.module.ts` — NestJS-модуль

### Ключевые модули

| Модуль | Описание | Резолверы |
|--------|----------|-----------|
| `account` | Аккаунты пользователей | getAccount, getAccounts, ... |
| `auth` | Аутентификация | login, refresh, logout, forgotPassword, resetPassword, verifyEmail |
| `registration` | Регистрация пайщиков | startRegistration, confirmRegistration, ... |
| `gateway` | Платёжный шлюз | createPaymentOrder, getPaymentOrders, ... |
| `document` | Документооборот | getDocuments, generateDocument, ... |
| `meet` | Общие собрания | getMeetings, createMeeting, vote, ... |
| `branch` | Кооперативные участки | getBranches, createBranch, ... |
| `agreement` | Соглашения | getAgreements, signAgreement, ... |
| `cooplace` | Маркетплейс | getProducts, createExchange, ... |
| `wallet` | Кошельки | getWallet, ... |
| `ledger` | Бухгалтерия | getLedgerOperations, ... |
| `participant` | Пайщики | getParticipants, ... |
| `notification` | Уведомления | subscribe, getNotifications, ... |
| `system` | Система | getSystemStatus, installSystem, ... |
| `desktop` | Рабочие столы | getDesktops, ... |
| `appstore` | Расширения (CRUD) | getExtensions, installExtension, updateExtension, ... |
| `blockchain-explorer` | Обозреватель | getActions, getTransaction, ... |
| `provider` | Провайдер-данные | getProviderData, ... |
| `free-decision` | Свободные решения | createFreeDecision, ... |
| `settings` | Настройки | getSettings, updateSettings |

---

## Система расширений (extensions/)

### Архитектура

Расширения — это модульные плагины, подключаемые к основному приложению. Каждое расширение:

1. **Наследует** `BaseExtModule` (или специализированный класс, например `PaymentProvider`, `IPNProvider`, `PollingProvider`)
2. **Реализует** `OnModuleInit` (NestJS lifecycle)
3. **Регистрируется** в `AppRegistry` (`extensions.registry.ts`)
4. **Загружается** через `ExtensionsModule.register()` (динамический NestJS-модуль)
5. **Имеет** Zod-схему конфигурации, которая валидирует и описывает поля для UI

### Базовый класс расширения

```typescript
@Injectable()
export abstract class BaseExtModule implements OnModuleInit {
  abstract name: string;                    // Уникальное имя
  abstract plugin: ExtensionDomainEntity;   // Сущность из БД
  abstract defaultConfig: Record<string, any>;  // Дефолтная конфигурация
  public configSchemas: ZodObject<any>;     // Zod-схема конфигурации
  abstract initialize(): Promise<void>;     // Инициализация при старте
}
```

### Реестр расширений (AppRegistry)

`extensions.registry.ts` содержит глобальный объект `AppRegistry` с описанием всех расширений:

```typescript
AppRegistry = {
  extensionName: {
    is_builtin: boolean,      // Встроенное?
    is_internal: boolean,     // Внутреннее?
    is_available: boolean,    // Доступно для установки?
    desktops?: IDesktopConfig[], // Рабочие столы (если есть — это desktop-расширение)
    title: string,
    description: string,
    class: Module,            // NestJS-модуль расширения
    pluginClass: Class,       // Класс плагина (для миграций)
    schema: ZodSchema,        // Zod-схема конфигурации
    readme: Promise<string>,  // Содержимое README.md
    instructions: Promise<string>, // Содержимое INSTALL.md
  }
}
```

### Типы расширений

- **Desktop-расширения** — предоставляют рабочий стол (UI workspace): `soviet`, `chairman`, `capital`, `participant`, `chatcoop`, `powerup`, `orders`
- **Платёжные расширения** — реализуют `PaymentProvider` / `IPNProvider` / `PollingProvider`: `yookassa`, `sberpoll`, `qrpay`
- **Интеграционные расширения** — синхронизация с внешними системами: `1ccoop`

### Иерархия платёжных провайдеров

```
BaseExtModule
├── PaymentProvider (extends BaseExtModule, implements PaymentProviderPort)
│   └── QrPayPlugin — генерация QR-кода для оплаты
├── IPNProvider (extends BaseExtModule)
│   └── YookassaPlugin — приём IPN-уведомлений от ЮKassa
└── PollingProvider (extends BaseExtModule)
    └── SberpollPlugin — опрос API Сбербанка
```

---

## Описание каждого расширения

### `builtin` — Встроенное расширение-заглушка
- **Файл**: `builtin/builtin-extension.module.ts`
- **Назначение**: Минимальное расширение без логики. Используется как класс плагина для расширений, которые не имеют собственной серверной логики (`soviet`, `trustee`, `participant`, `orders`)
- **Конфигурация**: Пустая Zod-схема `z.object({})`

### `chairman` — Стол Председателя
- **Структура**: `domain/`, `infrastructure/`, `application/` — полная чистая архитектура
- **Назначение**: Управление решениями совета кооператива. Председатель утверждает или отклоняет решения
- **Ключевые сервисы**:
  - `ApprovalService` — обработка утверждений
  - `ApprovalNotificationService` — уведомления о новых решениях
  - `ChairmanOnboardingService` — мастер настройки кооператива
  - `ChairmanSyncInteractor` — синхронизация решений из блокчейна
  - `ChairmanBlockchainAdapter` — взаимодействие с контрактом `soviet`
- **Резолверы**: `ApprovalResolver`, `ChairmanOnboardingResolver`
- **Крон**: Проверка решений каждые N минут (`checkInterval`)
- **Конфигурация**: `checkInterval`, `cancelApprovedDecisions`, `onboarding_*` — флаги прохождения мастера настройки

### `capital` — Благорост (целевая программа)
- **Структура**: `domain/`, `infrastructure/`, `application/` — самое крупное расширение
- **Назначение**: Управление интеллектуальными и имущественными вкладами по целевой программе «Благорост». Включает:
  - Управление проектами и участниками
  - Трекер времени
  - Инвестиционные взносы
  - Управление долгами и расходами
  - Голосование по методу Водянова
  - Распределение результатов
  - Генерация документов (договоры, акты, отчёты)
  - Регистрация участников программы
- **Резолверы** (14 штук): `project-management`, `participation-management`, `invests-management`, `debt-management`, `expenses-management`, `distribution-management`, `property-management`, `result-submission`, `time-tracker`, `voting`, `generation`, `segments`, `log`, `onboarding`, `capital-registration`
- **Синхронизация**: Синхронизация с GitHub-репозиторием (проекты ↔ issues)
- **Конфигурация**: `creators_voting_percent`, `authors_voting_percent`, `coordinator_bonus_percent`, `voting_period_in_days`, `energy_*`, `level_*`

### `chatcoop` — Стол связи
- **Структура**: `domain/`, `infrastructure/`, `application/` — полная архитектура
- **Назначение**: Интеграция с Matrix (чаты, звонки), транскрипция через LiveKit + Whisper
- **Ключевые сервисы**:
  - `MatrixApiService` — API Matrix-сервера (создание комнат, пользователей)
  - `MatrixUserManagementService` — управление пользователями в Matrix
  - `UnionChatService` — комнаты связи союза кооперативов
  - `SecretaryAgentService` — бот-секретарь для транскрипции звонков
  - `WhisperSttService` — Speech-to-Text через OpenAI Whisper
  - `TranscriptionManagementService` — управление транскрипциями
- **Резолверы**: `ChatCoopResolver`, `TranscriptionResolver`
- **REST-контроллер**: `LiveKitWebhookController` — обработка вебхуков LiveKit
- **При инициализации**: создаёт Matrix-пространство, комнаты пайщиков и совета, аккаунт секретаря
- **Конфигурация**: `spaceId`, `membersRoomId`, `councilRoomId`, `isInitialized`, `secretaryMatrixUserId`

### `participant` — Стол Пайщика
- **Файлы**: Один модуль без domain/infrastructure разделения
- **Назначение**: Уведомления пайщиков о собраниях, трекинг собраний
- **Ключевые сервисы**:
  - `MeetTrackerService` — отслеживание состояния собраний
  - `NotificationSenderService` — отправка уведомлений (email, push)
  - `MeetWorkflowNotificationService` — уведомления о workflow собраний
- **Крон**: Периодическая проверка состояния собраний
- **Конфигурация**: `checkInterval`, `meetNotifications` (настройки для каждого собрания)

### `powerup` — Вычислительные ресурсы
- **Файл**: `powerup/powerup-extension.module.ts`
- **Назначение**: Автоматическое пополнение вычислительных ресурсов блокчейн-аккаунта кооператива (CPU, NET, RAM)
- **Взаимодействие**: `BlockchainPort.powerUp()` — отправка транзакции powerup
- **Крон-задачи**:
  - Ежедневное пополнение (`0 0 * * *`)
  - Проверка ресурсов каждую минуту (`* * * * *`) — пополнение при превышении пороговых значений
- **Конфигурация**: `dailyPackageSize`, `thresholds.cpu/net/ram`, `systemSymbol`

### `yookassa` — ЮKassa (платёжный провайдер)
- **Файл**: `yookassa/yookassa-extension.module.ts`
- **Назначение**: Приём платежей через ЮKassa. Реализует `IPNProvider`
- **Методы**:
  - `createPayment(hash)` — создание платежа в ЮKassa (`embedded` confirmation)
  - `handleIPN(request)` — обработка IPN-уведомлений (`payment.succeeded`, `payment.failed`)
- **Комиссия**: `fee_percent: 3.5%`
- **Конфигурация**: `client` (shopId), `secret` (secretKey)

### `sberpoll` — Автоматический приём через Сбербанк
- **Файл**: `sberpoll/sberpoll-extension.module.ts`
- **Назначение**: Автоматический опрос API выписок Сбербанка для обнаружения поступлений. Реализует `PollingProvider`
- **Принцип**: Периодический опрос (`checkInterval`) → сопоставление поступлений с ожидаемыми платежами по назначению платежа
- **Конфигурация**: `secret`, `scope`, `checkInterval`, `accountNumber`

### `qrpay` — QR-оплата
- **Файл**: `qrpay/qrpay-extension.module.ts`
- **Назначение**: Генерация QR-кода для оплаты через любое банковское приложение. Реализует `PaymentProvider`
- **Метод**: `createPayment(hash)` — формирует URL оплаты с реквизитами кооператива из `@coopenomics/factory`
- **Комиссия**: `fee_percent: 0%`
- **Конфигурация**: Пустая (использует реквизиты из `constructCooperative`)

### `1ccoop` — Интеграция с 1С
- **Структура**: `domain/`, `infrastructure/`, `application/`
- **Назначение**: Двухсторонняя синхронизация документов кооператива с бухгалтерией 1С
- **Ключевые сервисы**:
  - `OneCoopApplicationService` — основной сервис синхронизации
  - `OneCoopBlockchainService` — чтение данных из блокчейна для 1С
  - `DocumentAdapterFactoryService` — фабрика адаптеров документов
  - `JoinCoopDocumentAdapter` — адаптер для документа вступления
- **REST-API**: Защищён `OneCoopSecretKeyGuard` (API-ключ в заголовке)
- **Резолвер**: `OneCoopResolver` — GraphQL-интерфейс для 1С
- **Конфигурация**: `secret_key` (авто-генерация), `base_url`

---

## GraphQL API

### Конфигурация

- **Драйвер**: Apollo (через `@nestjs/apollo`)
- **Генерация схемы**: `autoSchemaFile: 'schema.gql'` (code-first, авто-генерация ~10680 строк)
- **Endpoint**: `/v1/graphql`
- **Playground**: Включён (`/v1/graphql`)
- **Introspection**: Включена

### Директивы

- `@auth(roles: [...])` — документирует требуемые роли для поля/мутации
- `fieldAuth` — авторизация на уровне полей

### Основные типы GraphQL-схемы

**Корневые типы**:
- `Account` — агрегат аккаунта (blockchain_account + participant_account + provider_account + user_account)
- `DocumentAggregate` — агрегат документа (hash + document + rawDocument)
- `Payment` — платёж шлюза
- `Extension` — расширение
- `Branch` — кооперативный участок

**Перечисления**: `AccountType` (individual, entrepreneur, organization), `PaymentStatus`, `PaymentDirection` и др.

**Пагинация**: Типы `*PaginationResult` (items, totalCount, totalPages, currentPage)

---

## Аутентификация и авторизация

### JWT-стратегия

1. `JwtAuthStrategy` (passport-jwt) — извлекает токен из `Authorization: Bearer`
2. Валидирует `payload.type === ACCESS`
3. Загружает пользователя из `UserRepository` (поддержка legacy MongoDB ObjectId и UUID)
4. Возвращает объект пользователя в `request.user`

### Guards

| Guard | Назначение |
|-------|-----------|
| `HttpJwtAuthGuard` | Применяет JWT-стратегию для HTTP-запросов |
| `GraphqlJwtAuthGuard` | JWT-guard для GraphQL-контекста |
| `RolesGuard` | Проверка ролей + server-secret обход |

### Декораторы

- `@AuthRoles(['admin', 'chairman'])` — указание требуемых ролей + GraphQL-директива для документации
- `@CurrentUser` — извлечение текущего пользователя из контекста

### Авторизация

`RolesGuard` проверяет:
1. Заголовок `server-secret` → полный доступ (для inter-service вызовов)
2. Роли не заданы → свободный доступ
3. `data.username === user.username` → доступ к своим ресурсам
4. `user.role ∈ allowedRoles` → ролевой доступ
5. Иначе → 401 Unauthorized

---

## Блокчейн-взаимодействие

### Стек

- **EOSIO/Antelope** — блокчейн-платформа
- **@wharfkit/antelope, @wharfkit/session, @wharfkit/contract** — клиентские библиотеки
- **cooptypes** — типы смарт-контрактов (используются только в инфраструктуре!)

### Смарт-контракты

| Контракт | Назначение |
|----------|-----------|
| `registrator` | Регистрация аккаунтов, управление пользователями |
| `soviet` | Совет кооператива, решения, собрания, голосования |
| `marketplace` | Кооперативная площадка (cooplace) |
| `gateway` | Платёжный шлюз |
| `fund` | Фонд кооператива, кошельки |
| `eosio` | Системный контракт (powerup) |

### Паттерн работы

1. **Чтение** — через `BlockchainService.getSingleRow/getAllRows/query`
2. **Запись** — через `BlockchainService.transact(actions)`
3. **Авторизация транзакций** — через `VaultDomainService.getWif(username)` → `session.initialize(username, wif)`
4. **Преобразование типов** — в адаптерах с помощью `DomainToBlockchainUtils`

### Синхронизация данных

Для синхронизации состояния блокчейна с реляционной БД используются:
- `*DeltaMapper` — маппинг блокчейн-дельт в сущности БД
- `*SyncService` — сервисы синхронизации (Agreement, ProgramWallet, Approval)
- `EntityVersioningService` — версионирование при форках

---

## Генерация документов

### Поток

1. **Запрос** → Резолвер → Сервис → `GeneratorPort.generateDocument(data, options)`
2. **Инфраструктура** → `GeneratorInfrastructureService` → `@coopenomics/factory` (Generator)
3. **Factory** подключается к MongoDB, генерирует PDF по шаблону с данными кооператива
4. Документ сохраняется в MongoDB с хэшем
5. Хэш документа используется для подписания в блокчейне

### Ключевые интерфейсы

- `GeneratorPort` — доменный порт для генерации
- `DocumentDataPort` — порт для работы с данными документов
- `DocumentDomainAggregate` — агрегат (hash + signedDocument + rawDocument)
- `DocumentDomainEntity` — сущность сгенерированного документа

---

## Платёжный шлюз

### Архитектура

```
Пользователь → createPaymentOrder (mutation)
  → GatewayService → создаёт Payment в БД
    → ProviderDomainService.getProvider(name) → конкретный провайдер
      → provider.createPayment(hash) → возвращает PaymentDetails
```

### Типы провайдеров

1. **PaymentProvider** — генерирует данные для оплаты (qrpay)
2. **IPNProvider** — принимает IPN-уведомления (yookassa)
3. **PollingProvider** — опрашивает API банка (sberpoll)

### Регистрация провайдеров

При инициализации каждый платёжный плагин вызывает:
```typescript
this.providerPort.registerProvider(this.name, this);
```

---

## Конфигурация

### Переменные окружения (.env)

Все переменные валидируются Zod-схемой в `src/config/config.ts`. При ошибке — процесс завершается.

**Обязательные**:
- `NODE_ENV`, `BACKEND_URL`, `FRONTEND_URL`, `SERVER_SECRET`, `PORT`
- `MONGODB_URL`, `COOPNAME`
- `JWT_SECRET`
- Переменные PG-подключения: `HOST, PORT, USER, PASS, DB`
- `REDIS_HOST/PORT/PASSWORD`
- `BLOCKCHAIN_RPC`, `CHAIN_ID`
- `NOVU_APP_ID/API_KEY`
- `VAPID_PUBLIC_KEY/PRIVATE_KEY`
- `MATRIX_ADMIN_USERNAME/PASSWORD`

**Опциональные**:
- `SENTRY_DSN`, `GITHUB_TOKEN`
- `LIVEKIT_URL/API_KEY/API_SECRET` (для видеозвонков)
- `OPENAI_API_KEY/BASE_URL` (для транскрипции)
- `SMTP_*` (email)

---

## Ключевые зависимости

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| `@nestjs/*` | ^10-12 | Фреймворк бэкенда |
| `graphql`, `@nestjs/graphql`, `@nestjs/apollo` | ^16, ^12 | GraphQL API |
| `mongoose` | ^9 | MongoDB ODM |
| `typeorm` | 0.3.20 | Реляционный ORM (PG) |
| `@wharfkit/*` | ^1 | Взаимодействие с блокчейном EOSIO |
| `cooptypes` | workspace:* | Типы смарт-контрактов |
| `@coopenomics/factory` | workspace:* | Генератор документов |
| `@coopenomics/notifications` | workspace:* | Уведомления |
| `@coopenomics/sdk` | workspace:* | SDK |
| `ioredis` | ^5 | Redis-клиент |
| `@novu/api` | ^1 | Push/email уведомления |
| `livekit-server-sdk` | ^2 | Видеоконференции |
| `passport-jwt` | ^4 | JWT-аутентификация |
| `zod` | ^3 | Валидация схем |
| `winston` | ^3 | Логирование |
| `node-cron` | ^3 | Периодические задачи |
| `pdf-lib` / `html-pdf-node` | — | Генерация PDF |
| `@sentry/nestjs` | ^10 | Мониторинг ошибок |

---

## Process Registry — обязательные инварианты при добавлении операций ledger2

При добавлении нового `process_type` или нового `action_code` (в
`components/contracts/cpp/lib/core/ledger2/actions.hpp` → `ACTION_REGISTRY`)
**обязательно** одновременно обновить:

1. **`src/domain/process-registry/config/process-hash-locator.ts`** — добавить
   запись в `PROCESS_HASH_LOCATOR` (коды таблиц / имена полей entity-дельт,
   где ProcessRegistryService ищет `process_hash`) **и** в
   `ACTION_CODE_TO_PROCESS_TYPE` (маппинг action_code → process_type для
   phase A anchor-скана). Без этого `getProcess(hash)` вернёт неполный
   набор дельт — операции внутри процесса «утеряются» для UI.
2. **`src/domain/process-registry/config/document-field-detector.ts`** —
   добавить/расширить запись в `DOCUMENT_FIELDS` при появлении новой
   сущности с документом. Без этого подписанный документ процесса
   не подтянется в `ProcessDocument[]`.

Оба файла — источник истины для ProcessRegistryService; рассинхронизация
с контрактом приводит к тихим пропускам операций/документов. Любое
изменение `actions.hpp::ACTION_REGISTRY` обязывает к проверке обоих
файлов в том же PR.

---

## Cursor Cloud specific instructions

- **Линтинг**: `pnpm run lint --filter @coopenomics/controller` (ESLint)
- **Проверка типов**: `pnpm run typecheck --filter @coopenomics/controller`
- **Тесты**: интеграционные тесты запускаются через `@coopenomics/boot`, не в самом controller. Команда `pnpm run test --filter @coopenomics/controller` — заглушка (echo + exit 0)
- **Запуск dev**: `pnpm run dev --filter @coopenomics/controller` (nodemon + ts-node), требует MongoDB, PG (реляционную БД), Redis, блокчейн-ноду
- **Скрипты и команды**: см. таблицу в README.md
- **Установка зависимостей**: всегда через корень монорепы: `pnpm add <pkg> --filter @coopenomics/controller`
- Путь `~` в импортах — это алиас на `src/` (через `tsconfig-paths`)
