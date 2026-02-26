# TASKS.md — Прогресс выполнения задач

## Завершённые задачи
- ✅ 1. Dev-окружение
- ✅ 2. Security updates
- ✅ 3. Unified test pipeline (162/163)
- ✅ 4. README + описания компонентов
- ✅ 5. AGENTS.md для всех компонентов
- ✅ 6. Setup — профессиональный установщик
- ✅ 7. Поисковая система документов (OpenSearch)
- ✅ 8. Процессы (Capital extension) — бэкенд + фронтенд
- ✅ 9. Отчёты ФНС — 8 генераторов, фабрика, GraphQL API

---

## Активные задачи

### 10. Генерация отчётов ФНС (доработка) ✅
- [x] Фабрика генераторов (ReportRegistryService)
- [x] 8 генераторов (Бухбаланс, 6-НДФЛ, РСВ, ПСВ, ДУСН, 4-ФСС, Увед. взносы, УУСН)
- [x] GraphQL API (getAvailableReports, generateReport)
- [x] Генераторы переписаны по XSD — структура соответствует схемам ФНС
- [x] 48 unit-тестов для всех генераторов
- [x] Desktop UI (страница отчётов) — расширение reports
- [x] Интеграция с реальными данными ledger через LedgerInteractor
- [x] OrganizationDataInput DTO для передачи данных организации

### 11. CASL + гранулированные права доступа + шаринг страниц

#### 11.1 CASL — система прав доступа ✅
- [x] @casl/ability установлен
- [x] Action enum: manage, read, create, update, delete, execute, share
- [x] Subject enum: 30+ subjects для всех ресурсов
- [x] CaslAbilityFactory: role-based + granular permissions
- [x] CaslGuard + @CheckAbility decorator (обратная совместимость с RolesGuard)
- [x] role в user сохранено (chairman, member, user)
- [x] Тесты: 22/22 unit-тестов (chairman, member, user, granular permissions)

#### 11.2 Шаринг страниц ✅
- [x] ShareTokenEntity с JWT, guest/member targets
- [x] ShareService: create/verify/revoke
- [x] GraphQL: createShareLink, revokeShareLink, getMyShareLinks, getSharedWithMe
- [x] Два уровня: гости (linkName) и пайщики (targetUsername)
- [x] Granular allowedActions per share link
- [x] Кнопка "Поделиться" в Desktop Header (ShareHeaderAction)
- [x] Диалог управления правами (ShareDialog)
- [x] Страница "Доступные мне" на рабочем столе Пайщика (SharedWithMePage)

#### 11.3 Интеграция в desktop ✅
- [x] useShareButtonProcess: авто-регистрация на всех страницах
- [x] ShareButton + ShareDialog компоненты
- [x] Интеграция в init-app process
- [x] Валидация share tokens в route guard (frontend) — bypass ролей при наличии share_token

### 12. API ключи кооператива ✅
- [x] ApiKeyEntity: хеш ключа (sha256), префикс, операции, срок
- [x] ApiKeyService: create, validate, list, revoke
- [x] ApiKeyGuard: аутентификация через x-api-key header
- [x] GraphQL: createApiKey, getApiKeys, revokeApiKey (chairman only)
- [x] Безопасность: ключ показывается ТОЛЬКО при создании, хранится хеш
- [x] Desktop: ApiKeysPage в chairman extension
- [x] UI: таблица ключей, создание, отзыв, копирование

### 15. Стол заказов (Marketplace) — полная реализация

#### 15.1 Смарт-контракт marketplace — реорганизация
- [x] Исправить процесс: одно заявление в совет при accept (authcontrib), не два
- [x] Новый action requestreturn — заявление на возврат подаётся перед получением
- [x] authcontrib сразу ставит authorized
- [x] authreturn работает для статуса reqreturn → retauthorized
- [x] receive требует retauthorized (после авторизации возврата)
- [x] orderoffer убран product_return_statement (подаётся позже)
- [x] Путь coopstock — имущество уже в кооперативе
- [x] acceptstock — заказчик принимает coopstock (сразу в requestreturn)
- [x] Document::remove_document утилита
- [x] Уничтожение просроченного (destroy) — возврат средств, штраф, выплата поставщику
- [x] Перепредложение (reoffer) — закрытие старой заявки, создание coopstock с новой ценой
- [x] Система перевозок — уже реализована (shipment/)
- [x] Гарантийный возврат — уже реализован (dispute_on_offer/)
- [x] Сборка marketplace.wasm + marketplace.abi (test mode) — OK
- [x] ORDER→OFFER: createorder + respondoffer (заказчик публикует → поставщики откликаются)
- [x] delivery_type: internal (между КУ) / external (СДЭК и т.д.) в request struct
- [x] contribution_type: share (паевой) / member (членский) в request struct
- [x] Убраны ВСЕ any из controller marketplace (service, interactor)
- [x] Импортировано 87 файлов marketplace extension из ветки marketplace
- [x] Domain: 11 entities, 7 repositories, 5 services (БД-first архитектура)
- [x] Application: 30+ DTOs, 4 resolvers (категории, атрибуты, заявки)
- [x] Infrastructure: TypeORM entities, mappers, adapters
- [x] Архитектурный принцип: заявки в БД (draft→published), блокчейн при match
- [x] Накопительный характер заявок — CycleService (canStartSupply, checkExpiredCycles, cron)

#### 15.2 Генерация типов
- [x] Интерфейсы cooptypes: RequestReturn, Coopstock, AcceptStock, Destroy, Reoffer
- [x] ABI marketplace сохранён (31 action) для генерации типов

#### 15.3 Controller (бэкенд)
- [x] CooplaceBlockchainPort: 5 новых портов
- [x] CooplaceBlockchainAdapter: 5 реализаций (reqReturn, coopstock, acceptStock, destroy, reoffer)
- [x] DTOs: ReqReturnInput, CoopstockInput, AcceptStockInput, DestroyRequestInput, ReofferRequestInput
- [x] GraphQL resolvers: 5 новых мутаций с авторизацией
- [x] Service + Interactor: проброс до blockchain
- [x] ShipmentResolver: createShipment, signByDriver, arrived, receiveShipment
- [x] Интеграция с документами — через SignedDigitalDocumentInputDTO
- [x] MarketplaceEventService: 13 event handlers для синхронизации с блокчейном

#### 15.4 Desktop (фронтенд)
- [x] Маршруты: витрина, предложение, создание, мои заказы, модерация
- [x] install.ts расширения market обновлён с agreementsBase и roles
- [x] ReqReturnStep — шаг подачи заявления на возврат (step 7)
- [x] RetAuthorizedStep — шаг авторизации возврата советом (step 8)
- [x] Base.vue: новые статусы (reqreturn, retauthorized), badge coopstock
- [x] Панель председателя КУ: WarehousePage (склад, выдача, destroy/reoffer)
- [x] ShipmentsPage: таблица перевозок, timeline 4 этапов, создание
- [x] DisputePage: подача претензии, список, timeline спора, решение совета

#### 15.X Разделение cooplace на бэкенд и фронтенд расширения
- [x] CooplaceExtensionModule — бэкенд (карточки, категории, blockchain actions)
- [x] ProductCardResolver: CRUD карточек (draft→published→archived)
- [x] CategoryResolver: CRUD дерева категорий (chairman)
- [x] Domain entities: ProductCard (тип, статус, delivery_type, contribution_type), Category, SupplyOrder
- [x] Repositories: interfaces для карточек, категорий, заявок
- [x] GraphQL: 3 queries + 6 mutations для карточек/категорий
- [x] marketplace (desktop) — чистый фронтенд, использует API cooplace
- [x] market-admin (desktop) — уже существует (extensions/market-admin)
- [x] Controller стартует, 22+9 = 31 GraphQL endpoints

#### 15.Y Бэкенд карточек с циклами
- [x] TypeORM entities: ProductCard (циклы), Category, SupplyOrder
- [x] Repository adapters: CRUD + фильтры для всех entities
- [x] ProductCardService: модерация (draft→moderation→published), циклы (min_units, deadline)
- [x] addOrderToCard: инкремент cycle_collected_units, проверка min_units
- [x] checkCycleDeadline: истечение → возврат → новый цикл (cycle_number++)
- [x] ProductCardResolver: 9 queries/mutations с реальной БД логикой
- [x] CooplaceExtensionModule: полная DI с TypeORM
- [x] Исправлен белый экран desktop (vite-plugin-checker + share-button crash)

#### 15.Z Админка маркетплейса (настройки)
- [x] MarketplaceSettingsEntity: lead_request_policy, publish_access_policy, whitelist, moderation, cycles, delivery, prices
- [x] MarketplaceSettingsTypeormEntity + TypeORM repository (upsert)
- [x] MarketplaceSettingsResolver: get/update settings, add/remove whitelist
- [x] Перенесены ВСЕ DTOs/entities/repositories/services из extensions/marketplace → extensions/cooplace
- [x] Desktop SettingsPage: radio groups, toggles, whitelist chips, price inputs
- [x] market-admin: маршрут настроек как дефолтный + модерация + все заказы

#### 15.W Правильная логика match + cycles
- [x] MatchService: каждая встречная заявка → сразу в блокчейн (блокировка средств смарт-контрактом)
- [x] CycleService: min_units/deadline → порог для supply, НЕ для match
- [x] CycleService: cron каждые 5 мин — проверка истёкших циклов → cancel через блокчейн
- [x] MARKET-LOGIC.md обновлён с правильным принципом
- [x] AGENTS.md обновлён с описанием маркетплейса

#### 15.5 Тесты
- [x] Unit-тесты controller: 8 тестов marketplace actions + statuses (90/90 total)
- [x] cooptypes собран с новыми actions
- [x] Boot интеграционный тест: marketplace.test.ts (orderoffer + coopstock flows)
- [x] Boot тест marketplace.test.ts: orderoffer + coopstock flows

### 16. Документация (docs)
- [x] Раздел Cooplace: обзор архитектуры, жизненный цикл карточки, match, циклы
- [x] Раздел Cooplace/dev: GraphQL API reference (настройки, карточки, поставки, перевозки, диспуты)
- [x] Раздел Marketplace: пользовательская документация (витрина, заказ, администрирование)
- [x] TypeDoc JSON сгенерирован из SDK (137MB)
- [x] mkdocs.yml nav обновлён с «Стол заказов»
- [x] .gitignore для typedoc.json (генерируется при сборке)

### 17. Строгая типизация marketplace из ABI
- [x] marketplace.ts сгенерирован из ABI (38 интерфейсов: 31 action + 5 tables + 2 docs)
- [x] CooplaceBlockchainPort: все типы через Interfaces.Marketplace.* (0 any)
- [x] Adapter: 6 новых методов (shipments + ORDER→OFFER)
- [x] cooptypes собран (6.39 MB)

### 13. GraphQL Subscriptions ✅
- [x] PubSubModule: глобальный PubSub provider
- [x] WebSocket support в GraphQL module (graphql-ws)
- [x] 5 Capital subscriptions: issueUpdated/Created, commitCreated/Updated, dataChanged
- [x] systemStatusChanged — подписка на статус системы (install/init/update)
- [x] sovietDataChanged — подписка на события собраний/решений
- [x] Events publishing: GenerationService, ProjectManagementService, VotingService, SystemService, MeetEventService
- [x] SDK: Subscriptions namespace (Capital)
- [x] Auth через connectionParams.token
- [x] `useGraphqlSubscription` composable на фронтенде
- [x] **7 страниц Capital** переведены с polling на подписки
- [x] **System store** — WebSocket мониторинг вместо setTimeout
- [x] **init-wallet** — удалён рекурсивный setTimeout(run, 10_000)
- [x] **MeetDetails, ListOfAgenda, WaitingRegistration** — подписки вместо setInterval
- [x] **Provider, ConnectionAgreement** — удалён setInterval polling
- [x] 0 использований setInterval в прикладном коде (только UI-анимация энергии)
