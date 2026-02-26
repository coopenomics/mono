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

### 14. Модульная архитектура — @coopenomics/interops + система расширений
- [x] Пакет @coopenomics/interops: доменные порты, интерфейсы, shared-типы
- [x] IExtensionModule, IExtensionLoader, IExtensionMetadata контракты
- [x] ExtensionLoaderService — динамическое обнаружение @coopenomics/ext-* пакетов
- [x] Пакет @coopenomics/ext-capital создан (components/ext-capital/, 449 файлов)
- [x] ext-capital реализует IExtensionModule (index.ts)
- [x] ExtensionsModule: динамическая загрузка capital (ext-capital → builtin → skip)
- [x] extensions.registry.ts: опциональный импорт capital с fallback
- [x] Desktop extensions-registry: tryLoadCapitalInstall() с graceful degradation
- [x] AGENTS.md: архитектура расширений описана
- [ ] Полная изоляция импортов ext-capital от ~/domain/* (замена на @coopenomics/interops)
- [ ] Удаление capital из controller/src/extensions/ (после стабилизации)
- [ ] Приватизация ext-capital (отдельный npm registry)

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
