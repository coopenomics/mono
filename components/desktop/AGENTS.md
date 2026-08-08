# AGENTS.md — @coopenomics/desktop

Справочный документ для AI-агентов по фронтенд-компоненту «Рабочий стол кооператива».

## Обзор

`@coopenomics/desktop` — Vue 3 + Quasar Framework приложение с поддержкой SSR и SPA. Реализует рабочий стол для всех ролей кооператива: председатель, член совета, пайщик. Архитектура — **Feature Sliced Design (FSD)** с системой расширений (extensions).

**Стек**: Vue 3 (Composition API), Quasar 2, Pinia, Vue Router 4, Pug-шаблоны, TypeScript, Vue I18n, Wharfkit (EOSIO блокчейн), `@coopenomics/sdk` (GraphQL API клиент).

---

## Feature Sliced Design (FSD)

Проект следует методологии FSD. Слои расположены в `src/` и перечислены от верхнего (максимальная зависимость) к нижнему (минимальная зависимость):

```
src/
├── app/          # Слой приложения: корневой компонент, провайдеры, лейауты, стили
├── processes/    # Бизнес-процессы: инициализация, навигационные гвард-процессы, вотчеры
├── pages/        # Страницы: маршрутизируемые компоненты
├── widgets/      # Виджеты: составные блоки из нескольких фич/сущностей
├── features/     # Фичи: пользовательские действия (кнопки, формы, диалоги)
├── entities/     # Сущности: доменные модели + Pinia stores + API-слой
├── shared/       # Общее: утилиты, UI-kit, API-клиент, конфигурация, хуки
├── boot/         # Quasar boot-файлы: точки входа при старте приложения
├── stores/       # Конфигурация Pinia (создание и подключение плагинов)
├── desktops/     # Устаревший слой рабочих столов (сохранён для совместимости)
└── i18n/         # Локализация (ru-RU)
```

### Правило зависимостей FSD

Импорт разрешён **только сверху вниз**: `app` → `processes` → `pages` → `widgets` → `features` → `entities` → `shared`. Нарушение этого порядка — архитектурная ошибка.

---

## Слой app/ — Инициализация приложения

| Файл | Назначение |
|---|---|
| `App.vue` | Корневой компонент. Монтирует `<router-view>`, `RequireAgreements`, `SelectBranchOverlay`, `NotificationPermissionDialog`. Запускает `useDesktopHealthWatcherProcess` и OpenReplay-трекер. |
| `layouts/default.vue` | Основной лейаут: `Header`, левый `q-drawer` с `LeftDrawerMenu`, правый drawer с динамическими компонентами, `CmdkMenu`, `ContactsFooter`. |
| `layouts/widget.vue` | Widget-лейаут: минимальная обёртка для встраивания desktop в iframe. Управляется через `useWidgetBridge`. |
| `layouts/useDefaultLayoutLogic.ts` | Composable с логикой лейаута: управление drawer, определение мобильного устройства, состояние авторизации. |
| `providers/router.ts` | Создание Vue Router. Режим: `createMemoryHistory` (SSR), `createWebHashHistory` (SPA), `createWebHistory` (history mode). |
| `providers/routes/index.ts` | Базовые маршруты: `signin`, `signup`, `lostkey`, `resetkey`, `invite`, `install`, `privacy`, `login-redirect`, `NotFound`. Маршруты расширений добавляются **динамически** через `router.addRoute('base', ...)`. |
| `config/index.ts` | Re-export конфигурации Quasar. |

### DynamicLayoutWrapper

В `routes/index.ts` определён `DynamicLayoutWrapper` — компонент-обёртка, выбирающий лейаут в runtime: если десктоп открыт в iframe или с `?widget=true`, используется `widget.vue`, иначе `default.vue`.

---

## Слой entities/ — Доменные сущности

Каждая сущность следует структуре: `model/` (store, types), `api/` (запросы), `ui/` (компоненты, если есть).

### Ключевые сущности

| Сущность | Store | Описание |
|---|---|---|
| **Desktop** | `useDesktopStore` | Центральный store рабочего стола. Управляет workspaces, активным рабочим столом, меню, маршрутами. Загружает конфигурацию через `getDesktop` GraphQL-запрос. |
| **Session** | `useSessionStore` | Управление авторизацией. Хранит `isAuth`, `username`, `session` (Wharfkit Session), `currentUserAccount`. Вычисляемые свойства: `isChairman`, `isMember`, `isRegistrationComplete`. |
| **System** | `useSystemStore` | Системная информация кооператива: `info` (coopname, system_status, contacts, vars, settings). Мониторинг доступности бэкенда с экспоненциальным backoff. |
| **Extension** | `useExtensionStore` | Загрузка и хранение расширений с бэкенда (`getExtensions`). |
| **Wallet** | `useWalletStore` | Кошелёк пользователя: балансы, подписанные соглашения. |
| **Account** | `useAccountStore` | Данные аккаунта: `user_account`, `private_account`, `blockchain_account`, `participant_account`, `provider_account`. |
| **Agreement** | `useAgreementStore` | Шаблоны и текущие соглашения кооператива. |
| **Branch** | `useBranchStore` | Кооперативные участки. |
| **Agenda** | `useAgendaStore` | Повестка совета: вопросы на голосование. |
| **User** | — | Данные о пользователях кооператива. |
| **Cooperative** | — | Информация о кооперативе. |
| **Document** | — | Работа с документами. |
| **Meet** | — | Собрания. |
| **Registration** | — | Процесс регистрации пайщиков. |
| **Union** | — | Союз кооперативов. |

### Desktop Store — подробнее

Файл: `src/entities/Desktop/model/store.ts`

- `loadDesktop()` — загружает конфигурацию с бэкенда (`getDesktop` GraphQL). Возвращает список workspaces, каждый с `name`, `title`, `icon`.
- `setRoutes(workspaceName, routes)` — привязывает маршруты расширения к workspace.
- `selectWorkspace(name)` — активирует workspace, сохраняет выбор в `localStorage`.
- `selectDefaultWorkspace()` — логика выбора: 1) сохранённый в localStorage, 2) chairman для председателя, 3) из настроек системы (`authorized_default_workspace`), 4) fallback на `participant`.
- `registerWorkspaceMenus(router)` — регистрирует маршруты всех workspaces в Vue Router через `router.addRoute('base', ...)`.
- `goToDefaultPage(router)` — навигация на страницу по умолчанию для текущего workspace.
- `workspaceMenus` — computed: массив `WorkspaceMenuItem[]` для отображения в меню.
- `activeSecondLevelRoutes` — computed: дочерние маршруты текущего workspace для бокового меню.
- `isWorkspaceChanging` — флаг переключения между workspaces (показывает лоадер).

### Session Store — подробнее

Файл: `src/entities/Session/model/store.ts`

- `init()` — инициализация: загрузка из IndexedDB (зашифрованные ключи, токены), создание Wharfkit Session.
- `close()` — logout: очистка auth-состояния, удаление ключей.
- Хранение credentials — зашифровано в IndexedDB (через `useGlobalStore`), не в Pinia/localStorage.
- `currentUserAccount` — полный объект IAccount с вложенными `user_account`, `private_account`, `blockchain_account`, `participant_account`, `provider_account`.

### Global Store

Файл: `src/shared/store/index.ts`

Низкоуровневый store для работы с блокчейном: хранение приватного ключа, создание и отправка транзакций (`transact`), подпись дайджестов. Credentials шифруются AES и хранятся в IndexedDB (в scope `info.coopname`).

---

## Слой processes/ — Бизнес-процессы

| Процесс | Файл | Описание |
|---|---|---|
| **init-app** | `index.ts` | Главный процесс инициализации. Вызывается из boot-файла `init.ts`. Последовательность: `loadSystemInfo()` → `loadDesktop()` → `registerWorkspaceMenus()` → `initWalletProcess()` → `selectDefaultWorkspace()` → `useBranchOverlayProcess()` → `setupNavigationGuard()` → `useInitExtensionsProcess()`. |
| **init-wallet** | `index.ts` | Инициализация кошелька: `session.init()` → `account.getAccount()` → `wallet.loadUserWallet()`. Фоновая проверка каждые 10 сек. Автоматический logout при невалидном JWT. |
| **init-installed-extensions** | `index.ts` | Загрузка всех расширений из `extensionsRegistry`. Для каждого: вызов `install()` → `store.setRoutes()` → `router.addRoute()`. |
| **navigation-guard-setup** | `index.ts` | Настройка `router.beforeEach`: редирект на `install` при установке, ожидание `loadComplete`, определение роли, редирект с `index` на страницу по умолчанию, проверка `requiresAuth`, ролевой доступ. |
| **watch-desktop-health** | `index.ts` | Мониторинг `system_status`. При `maintenance` — полноэкранный оверлей `QSpinnerGears`. При выходе из maintenance — `window.location.reload()`. |
| **watch-branch-overlay** | `index.ts` | Показывает оверлей выбора кооперативного участка, если кооператив в мажоритарном режиме и пользователь не выбрал участок. |
| **select-branch** | `index.ts` | Stepper-процесс выбора кооперативного участка: выбор → генерация документа → подпись → отправка. |
| **process-decisions** | `index.ts` | Процесс обработки решений совета. Использует `DecisionFactory` для генерации документов. Голосование за/против, авторизация и исполнение решений. |
| **init-push-notifications** | — | Инициализация push-уведомлений (Novu). |

### Последовательность инициализации

```
quasar.config.cjs boot: ['widget', 'init', 'i18n', 'axios', 'sentry', 'network', 'chatwoot']
                           │
                     boot/init.ts
                           │
                  useInitAppProcess(router)
                           │
         ┌─────────────────┼──────────────────────────┐
         │                 │                           │
  loadSystemInfo()  loadDesktop()           registerWorkspaceMenus()
                                                       │
                                              useInitWalletProcess()
                                                       │
                                            selectDefaultWorkspace()
                                                       │
                                          setupNavigationGuard(router)
                                                       │
                                         useInitExtensionsProcess(router)
```

---

## Слой boot/ — Quasar Boot-файлы

Порядок задан в `quasar.config.cjs` → `boot: ['widget', 'init', 'i18n', 'axios', 'sentry', 'network', 'chatwoot']`.

| Файл | Описание |
|---|---|
| `widget.ts` | Первым определяет widget-режим (iframe). Настраивает navigation guard, global properties, provide/inject. |
| `init.ts` | Вызывает `useInitAppProcess(router)` — основной процесс инициализации приложения. |
| `i18n.ts` | Инициализация Vue I18n с русской локалью. |
| `axios.ts` | Настройка Axios (в основном для legacy; основной API-клиент — `@coopenomics/sdk`). |
| `sentry.ts` | Подключение Sentry для мониторинга ошибок (только production). |
| `network.ts` | Инициализация PWA network utils (только production или с флагом `ENABLE_PWA_DEV`). |
| `chatwoot.ts` | Интеграция с Chatwoot (чат поддержки). |

---

## Система расширений (extensions/)

### Архитектура

Расширения — это модули, каждый из которых предоставляет один или несколько **workspaces** (рабочих столов). Каждый workspace определяет набор маршрутов (страниц), доступных пользователю.

```
extensions/
├── chairman/      # Стол председателя
├── soviet/        # Стол совета
├── participant/   # Стол пайщика
├── capital/       # Благорост (паевые взносы, проекты, трекер)
├── chatcoop/      # Кооперативный мессенджер
├── market/        # Стол заказов (маркетплейс)
├── market-admin/  # Стол администратора маркетплейса
└── powerup/       # Стол вычислительных ресурсов
```

### Как работает система расширений

1. **Регистрация**: файл `src/processes/init-installed-extensions/extensions-registry.ts` содержит единый реестр:
   ```ts
   export const extensionsRegistry: Record<string, () => Promise<IWorkspaceConfig[]>> = {
     capital: capitalInstall,
     chairman: chairmanInstall,
     // ...
   };
   ```

2. **Установка**: каждое расширение экспортирует `install.ts` — async-функцию, возвращающую `IWorkspaceConfig[]`:
   ```ts
   interface IWorkspaceConfig {
     workspace: string        // уникальное имя workspace
     extension_name: string   // имя расширения
     title?: string           // отображаемое название
     icon?: string            // FontAwesome-иконка
     defaultRoute?: string    // маршрут по умолчанию
     routes: IWorkspaceRoute[]
   }
   ```

3. **Загрузка** (`useInitExtensionsProcess`):
   - Проходит по всем расширениям в `extensionsRegistry`
   - Вызывает `install()` каждого расширения
   - Записывает маршруты в `DesktopStore.setRoutes(workspace, routes)`
   - Регистрирует маршруты в Vue Router: `router.addRoute('base', route)`

4. **Рендеринг**: бэкенд через `getDesktop` GraphQL-запрос возвращает список workspaces с `name` и `title`. Фронтенд сопоставляет их с зарегистрированными маршрутами.

### Как добавить новое расширение

1. Создайте директорию `extensions/<name>/`
2. Создайте `install.ts`:
   ```ts
   import { markRaw } from 'vue'
   import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace'
   import { MyPage } from './pages/MyPage'

   export default async function(): Promise<IWorkspaceConfig[]> {
     return [{
       workspace: '<name>',
       extension_name: '<name>',
       title: 'Название',
       icon: 'fa-solid fa-icon',
       defaultRoute: 'my-route',
       routes: [{
         meta: { title: 'Название', icon: 'fa-solid fa-icon', roles: [] },
         path: '/:coopname/<name>',
         name: '<name>',
         children: [{
           path: 'my-page',
           name: 'my-route',
           component: markRaw(MyPage),
           meta: { title: 'Страница', icon: 'fa-solid fa-icon', roles: [] },
         }],
       }],
     }]
   }
   ```
3. Зарегистрируйте в `extensions-registry.ts`:
   ```ts
   import newExtInstall from '../../../extensions/<name>/install'
   // ...
   export const extensionsRegistry = {
     // ...
     '<name>': newExtInstall,
   }
   ```
4. **Важно**: компоненты в маршрутах оборачивайте в `markRaw()` для предотвращения реактивной обёртки Vue (критично для SSR-сериализации).

### Описание расширений

| Расширение | Workspace | Роли | Описание | Ключевые страницы |
|---|---|---|---|---|
| **chairman** | `chairman` | chairman | Стол председателя: одобрение запросов, управление расширениями, настройки кооператива, члены совета, участки, взносы, провайдер платежей, контакты. | `ApprovalsPage`, `ExtensionsManagement`, `SystemSettingsPage`, `MembersPage`, `MemberBranchList` |
| **soviet** | `soviet` | chairman, member | Стол совета: повестка, реестр пайщиков, документы, платежи, собрания, бухгалтерия (ledger), кооперативы союза. | `ListOfAgendaQuestions`, `ListOfParticipantsPage`, `ListOfDocumentsPage`, `PaymentsPage`, `ListOfMeetsPage`, `ListOfLedgerAccountsPage` |
| **participant** | `participant` | user, chairman, member | Стол пайщика: кошелёк, профиль, подключение к кооперативу, реквизиты, документы, платежи, собрания, контакты, поддержка. | `WalletPage`, `ProfilePage`, `ConnectionAgreementPage`, `UserPaymentMethodsPage` |
| **capital** | `capital` | все | Благорост: профиль вклада, регистрация, проекты, трекер времени, коммиты, голосования, результаты, приглашения, лента активности. Имеет собственную систему обработчиков решений через `registerCapitalDecisionHandlers()`. | `CapitalProfilePage`, `ProjectsListPage`, `TrackerPage`, `ProjectsVotingPage` |
| **chatcoop** | `chatcoop` | chairman, member, user | Кооперативный мессенджер: быстрый клиент, мобильный клиент, транскрипции звонков. | `ChatCoopPage`, `MobileClientPage`, `TranscriptionsPage` |
| **market** | `market` | все | Стол заказов: витрина, создание объявлений, мои объявления, мои заказы. | `ShowcasePage`, `CreateMarketplaceOfferPage`, `UserParentOffersPage`, `MyOrdersPage` |
| **market-admin** | `market-admin` | chairman, member | Стол администратора маркетплейса: модерация, управление заказами. | `ModerationPage`, `SuppliesListPage` |
| **powerup** | `powerup` | chairman, member | Стол вычислительных ресурсов: мониторинг, настройки аренды, логи. | `MonitorPage`, `SettingsPage`, `LogsPage` |

### DecisionFactory — расширяемая система решений

Файл: `src/shared/lib/decision-factory/index.ts`

Паттерн фабрики для генерации документов решений совета. Расширения регистрируют свои обработчики:
```ts
decisionFactory.registerHandler('my_type', {
  generateHandler: async (data) => { /* ... */ },
  infoComponent: MyInfoComponent,  // опционально
})
```

Базовые обработчики регистрируются в `processes/process-decisions/handlers/`. Расширение `capital` регистрирует собственные обработчики при загрузке (`registerCapitalDecisionHandlers()`).

---

## Слой pages/ — Страницы

Структура страниц соответствует разделам приложения:

| Директория | Описание |
|---|---|
| `Cooperative/` | Страницы кооператива: участники, документы, платежи, собрания, бухгалтерия, участки, контакты, взносы |
| `User/` | Страницы пользователя: профиль, кошелёк, документы, платежи, реквизиты |
| `Registrator/` | Аутентификация: `SignIn`, `SignUp`, `LostKey`, `ResetKey`, `Invite` |
| `Union/` | Союз: установка кооператива, соединение с кооперативом, список кооперативов |
| `ExtensionStore/` | Магазин расширений: витрина, установленные, страница расширения, управление |
| `Marketplace/` | Маркетплейс: витрина, создание предложений, модерация, заказы |
| `Contacts/` | Контактная информация кооператива |
| `Support/` | Страница поддержки (интеграция с Chatwoot) |
| `Blank/` | Заглушка 404 |
| `PermissionDenied/` | Страница отказа в доступе |
| `Privacy/` | Политика конфиденциальности |

---

## Слой widgets/ — Виджеты

| Виджет | Описание |
|---|---|
| `Header/CommonHeader` | Главная шапка: логотип, название кооператива, `WorkspaceMenu` (переключатель рабочих столов), действия пользователя |
| `Desktop/LeftDrawerMenu` | Левое боковое меню: `CmdkTrigger` (поиск), `SecondLevelMenuList` (пункты меню текущего workspace), `MicroWallet`, `LogoutButton` |
| `Desktop/CmdkMenu` | Cmd+K меню — быстрый поиск/навигация по всем workspaces |
| `Desktop/WorkspaceMenu` | Переключатель workspaces (рабочих столов) в шапке |
| `Desktop/SecondLevelMenuList` | Список пунктов меню для текущего workspace |
| `RequireAgreements` | Автоматически показывает диалоги подписания обязательных соглашений (wallet, privacy, signature, user). Проверяет версии подписанных соглашений. |
| `NotificationCenter` | Центр уведомлений (Novu) |
| `Wallet/` | Виджеты кошелька: `MicroWallet` (компактное отображение) |
| `Registrator/` | Виджеты регистратора |
| `Meets/` | Виджеты собраний |
| `Marketplace/` | Виджеты маркетплейса |
| `ConnectionAgreementStepper` | Stepper подключения к кооперативу |
| `ConnectionDashboard` | Дашборд подключения |
| `Cooperative/` | Виджеты кооператива |
| `User/` | Виджеты пользователя |
| `Participants/` | Виджеты участников |
| `Questions/` | Виджеты вопросов |

---

## Слой features/ — Фичи

Организованы по доменным областям:

| Feature | Описание |
|---|---|
| `User/` | Авторизация (`LoginRedirect`, `Logout`), управление профилем |
| `Wallet/` | Операции с кошельком |
| `Extension/` | Установка, обновление, удаление расширений |
| `Branch/` | Выбор кооперативного участка (`SelectBranch`) |
| `Decision/` | Голосование за/против решений, авторизация решений |
| `Cooperative/` | Действия с кооперативом |
| `Agreementer/` | Подписание соглашений (`SignAgreementDialog`, `GenerateAgreement`) |
| `Request/` | Обработка запросов различных типов |
| `Meet/` | Управление собраниями |
| `Installer/` | Установка кооператива |
| `Union/` | Операции союза |
| `NotificationPermissionDialog/` | Запрос разрешения на push-уведомления |
| `WebPushNotifications/` | Управление web push подписками |
| `Payment/` | Платежи |
| `PaymentMethod/` | Управление реквизитами |
| `Provider/` | Провайдер платежей |
| `System/` | Системные настройки |
| `Account/` | Управление аккаунтом |
| `FreeDecision/` | Свободные решения |

---

## Слой shared/ — Общие модули

### API-клиент

Файл: `src/shared/api/client.ts`

Использует `@coopenomics/sdk` Client:
```ts
export const client = Client.create({
  api_url: env.BACKEND_URL + '/v1/graphql',
  chain_url: env.CHAIN_URL,
  chain_id: env.CHAIN_ID,
})
```

Все GraphQL-запросы выполняются через `client.Query(...)` и `client.Mutation(...)` с типизированными SDK-методами.

### Конфигурация окружения

Файл: `src/shared/config/Environment.ts`

Переменные окружения определяются из нескольких источников (в порядке приоритета):
1. `window.__APP_CONFIG__` (инжектирован в HTML)
2. Загрузка `/config.js` синхронным XMLHttpRequest (fallback)
3. `process.env` (для SSR / dev)

Экспортирует `env` — Proxy-объект с ленивым доступом к переменным.

Ключевые переменные: `BACKEND_URL`, `CHAIN_URL`, `CHAIN_ID`, `CURRENCY`, `COOP_SHORT_NAME`, `STORAGE_URL`, `UPLOAD_URL`, `TIMEZONE`, `NOVU_APP_ID`, `NOVU_BACKEND_URL`, `VAPID_PUBLIC_KEY`, `SENTRY_DSN`, `OPENREPLAY_PROJECT_KEY`.

### shared/lib/

| Модуль | Описание |
|---|---|
| `composables/` | Общие composables: `useDisplayName`, `usePWAThemeColor` и др. |
| `consts/` | Константы: списки контрактов, таблиц, действий блокчейна |
| `decision-factory/` | Паттерн фабрики решений (описан выше) |
| `document/` | Класс `DigitalDocument` — генерация и подписание цифровых документов |
| `navigation/` | Хелперы навигации |
| `proxy/` | Proxy-утилиты |
| `stores/` | Общие store-утилиты |
| `types/` | Общие типы: `IWorkspaceConfig`, `IWorkspaceRoute`, crypto-типы, типы пользователей и др. |
| `utils/` | Утилиты: `applyThemeFromStorage`, `getNameFromCertificate` и др. |
| `widget/` | Widget-система: `widget-mode`, `widget-events`, `use-widget-bridge` |

### shared/ui/

Более 50 переиспользуемых UI-компонентов: `AuthCard`, `AutoAvatar`, `BaseDocument`, `BranchSelector`, `ClientOnly`, `ColorCard`, `CopyableInput`, `CreateDialog`, `DiffViewer`, `DocumentHtmlReader`, `Editor`, `Form`, `Loader`, `Map`, `Pagination`, `QRCode` и многие другие.

### shared/hooks/

- `useRightDrawer` — управление правым drawer (inject/provide паттерн для добавления действий из любого компонента)

---

## Навигация и авторизация

### Навигационные гварды

Файл: `src/processes/navigation-guard-setup/index.ts`

`router.beforeEach` проверяет:

1. **Режим установки**: если `system_status === 'install'` или `'initialized'` — редирект на `/install`.
2. **Ожидание загрузки**: если `session.isAuth && !session.loadComplete` — ждём до 5 сек.
3. **Определение роли**: `chairman` | `member` | `user` | `null`.
4. **Редирект с `index`**: авторизованный → `getDefaultPageRoute()`, неавторизованный → `signup`.
5. **Проверка `requiresAuth`**: если маршрут требует авторизацию, но пользователь не авторизован → сохраняет URL в `LocalStorage` → редирект на `login-redirect`.
6. **Ролевой доступ**: `meta.roles` — если массив пуст, доступ для всех; если указаны роли — проверка.

### Мета-данные маршрутов

```ts
meta: {
  title: string          // заголовок страницы
  icon: string           // FontAwesome-иконка
  roles: string[]        // допустимые роли ([] = все)
  agreements?: string[]  // требуемые подписанные соглашения
  requiresAuth?: boolean // требуется авторизация
  conditions?: string    // условие отображения в меню
  action?: string        // имя действия вместо перехода
  hidden?: boolean       // скрыть из бокового меню
  widget?: { title, hideHeader, hideFooter }  // настройки widget-режима
}
```

### RequireAgreements

Виджет `RequireAgreements` (в `App.vue`) автоматически проверяет, подписал ли пользователь обязательные соглашения для текущего маршрута (`meta.agreements`). Если нет или версия устарела — показывает модальный диалог подписания.

Типы соглашений: `wallet`, `privacy`, `signature`, `user`.

---

## Паттерны кода

### Pug + Composition API

Все компоненты используют Pug-шаблоны с `<script setup lang="ts">`:

```vue
<template lang="pug">
q-page
  q-card
    q-card-section
      .text-h6 Заголовок
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
// ...
</script>
```

### Индексные файлы

Каждый компонент/модуль экспортируется через `index.ts`:

```ts
// ui/index.ts
export { default as MyComponent } from './MyComponent.vue'

// index.ts (на уровень выше)
export * from './ui'
```

### Composables вместо emit

Предпочтение отдаётся composable-функциям для межкомпонентной коммуникации вместо emit. Emit — только в крайнем случае.

### markRaw для компонентов в маршрутах

Все компоненты в `routes` оборачиваются в `markRaw()` — это предотвращает реактивную обёртку Vue и критично для корректной работы SSR-сериализации Pinia.

---

## SSR vs SPA

### Режимы запуска

| Команда | Режим | Порт | Описание |
|---|---|---|---|
| `pnpm run dev` | SSR dev | 2999 | `quasar dev --mode ssr` |
| `pnpm run devnet` | SPA dev | 2999 | `quasar dev` (hash router) |
| `pnpm run build` | SSR prod | 3000 | `quasar build --mode ssr` |
| `pnpm run build:spa` | SPA prod | — | `quasar build` |

### Известная проблема SSR

**В dev-режиме SSR расширения не рендерятся**. Причина: Pinia при SSR-сериализации (state transfer server→client) пытается сериализовать Vue-компоненты, хранящиеся в `DesktopStore.workspaces[].routes` (через `markRaw`). Компоненты не сериализуемы, и на клиенте workspaces остаются без маршрутов.

**Рекомендация**: для разработки использовать SPA-режим (`pnpm run devnet`). Production SSR-сборка работает корректно, т.к. расширения загружаются на клиенте после гидрации.

### SSR-безопасность

Код содержит проверки `typeof window === 'undefined'` для:
- `localStorage` → `safeLocalStorageGetItem/SetItem`
- `setInterval/setTimeout` → не запускаются на сервере
- OpenReplay / Sentry / Chatwoot → только на клиенте

---

## Widget-режим

Desktop может работать как встраиваемый виджет (iframe). Определяется автоматически:
- `window.parent !== window` (встроен в iframe)
- `?widget=true` параметр URL

Widget-режим использует облегчённый лейаут (`widget.vue`) и коммуникацию с хостом через `postMessage` (файл `src/shared/lib/widget/`).

---

## Конфигурация проекта

### quasar.config.cjs

- **Boot files**: `['widget', 'init', 'i18n', 'axios', 'sentry', 'network', 'chatwoot']`
- **Router mode**: `hash` (по умолчанию)
- **Dev server**: порт `2999`, host `0.0.0.0`
- **SSR prod port**: `3000`
- **Source files**: `rootComponent: 'src/app/App.vue'`, `router: 'src/app/providers/router'`
- **PWA**: включена в production, в dev — с флагом `ENABLE_PWA_DEV`
- **SSR middleware**: `['generateConfig', 'render']` — `generateConfig` генерирует `config.js` с переменными окружения для клиентской конфигурации

### Переменные окружения

Копировать из `Env-example.ts` или `.env-example`:
- `BACKEND_URL` — URL GraphQL API контроллера (localhost, порт 2998)
- `CHAIN_URL` — URL EOSIO-ноды (localhost, порт 8888)
- `CHAIN_ID` — идентификатор блокчейна (получить из endpoint `v1/chain/get_info` на ноде)
- `CURRENCY`, `COOP_SHORT_NAME`, `TIMEZONE`, `STORAGE_URL`, `UPLOAD_URL`
- `SENTRY_DSN`, `OPENREPLAY_PROJECT_KEY`, `NOVU_APP_ID` — мониторинг и уведомления

---

## Скрипты

| Команда | Описание |
|---|---|
| `pnpm run lint` | ESLint для `.js`, `.ts`, `.vue` |
| `pnpm run typecheck` | `tsc --noEmit --skipLibCheck` |
| `pnpm run format` | Prettier |
| `pnpm run dev` | SSR dev (порт 2999) |
| `pnpm run devnet` | SPA dev (порт 2999) |
| `pnpm run build` | SSR production build |
| `pnpm run build:spa` | SPA production build |
| `pnpm run start` | Запуск SSR production |

---

## Зависимости от других компонентов монорепозитория

| Пакет | Описание |
|---|---|
| `@coopenomics/sdk` | GraphQL SDK-клиент (типы, запросы, мутации, подписки) |
| `@coopenomics/notifications` | Типы и утилиты уведомлений |
| `cooptypes` | Общие типы кооперативных контрактов и документов |

Перед разработкой desktop необходимо собрать зависимости (порядок важен):
```bash
pnpm --filter cooptypes run build
pnpm --filter @coopenomics/factory run build
pnpm --filter @coopenomics/sdk run build
pnpm --filter @coopenomics/notifications run build
```

---

## Правила для AI-агентов

1. **Монорепозиторий**: установка пакетов **только** через `pnpm add <pkg> --filter @coopenomics/desktop` из корня.
2. **FSD-архитектура**: соблюдайте направление зависимостей. Не импортируйте из `pages/` в `entities/`.
3. **Pug + Composition API**: все новые компоненты — `<template lang="pug">` + `<script setup lang="ts">`.
4. **index.ts**: всегда создавайте индексные файлы: `export { default as Name } from './Name.vue'` на уровне `ui/`, `export * from './ui'` на уровень выше.
5. **Неиспользуемые импорты**: всегда удаляйте.
6. **Composables вместо emit**: предпочитайте composable-функции для межкомпонентной коммуникации.
7. **markRaw()**: оборачивайте компоненты в маршрутах расширений.
8. **SSR-безопасность**: проверяйте `typeof window !== 'undefined'` перед доступом к `window`, `localStorage`, `document`.
9. **SDK-запросы**: используйте `client.Query(...)` / `client.Mutation(...)` из `src/shared/api/client.ts` с типизированными SDK-методами. Подробнее — см. cursor rule `desktop-sdk-queries-mutations.mdc`.
10. **Расширения**: при добавлении нового расширения обновите `extensions-registry.ts`.
