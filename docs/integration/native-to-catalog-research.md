# Native extensions → Apps Catalog: research-доклад

Документ выполнен на ветке `apps-catalog` от `dev` в mono. Цель — спроектировать **гармоничную** интеграцию каталога приложений (apps-catalog: ca-auth/ca-admin/Nexus + on-chain контракт `apps`) в существующий монолит, **не ломая** сегодняшнюю модель native-extensions (capital/chairman/chatcoop/participant/powerup/reports/soviet).

Документ — план, не реализация. Stories 1.3–1.12 продолжатся в apps-catalog репозитории отдельно.

## 0. Контекст и стейкхолдер

- Пользователь хочет: 7 текущих native extensions **продолжают работать как есть** (bundle, in-memory installer), но **появляются в магазине** как «уже установлено». Новые extension'ы постепенно вытаскиваются из bundle и устанавливаются динамически через каталог по платной/бесплатной модели.
- Чисто заменять одно на другое («ломая всё») запрещено.
- В исследовании надо найти **минимальный шов**, который позволит сосуществовать `bundle` и `remote` режимам.

## 1. As-is: что сейчас в mono

### 1.1. Frontend (desktop)

```
components/desktop/extensions/
├── capital/install.ts        ← IWorkspaceConfig[]
├── chairman/install.ts
├── chatcoop/install.ts
├── participant/install.ts
├── powerup/install.ts
├── reports/install.ts
└── soviet/install.ts
```

- Каждый `install.ts` — экспорт `default async () => IWorkspaceConfig[]`, где `IWorkspaceConfig` = `{ workspace, extension_name, title?, icon?, defaultRoute?, routes }` (`components/desktop/src/shared/lib/types/workspace.ts:24`).
- Bundle-time registry: `components/desktop/src/processes/init-installed-extensions/extensions-registry.ts` импортирует все 7 install-функций и кладёт в `Record<string, () => Promise<IWorkspaceConfig[]>>`.
- Process: `useInitExtensionsProcess(router)` (`processes/init-installed-extensions/index.ts:6`) на старте SSR-приложения вызывает **все** install-функции последовательно и пушит их routes в `desktopStore` + Vue Router. Никаких «не показывать» — все 7 столов всегда зарегистрированы в bundle.
- Видимость столов конкретному кооперативу / роли — отдельный слой (см. backend grants ниже + `meta.roles`/`meta.conditions` в IWorkspaceRoute).

**Существующий UI «магазин»:**
- `components/desktop/src/pages/ExtensionStore/{BaseRoute, ExtensionPage, ExtensionsManagement, ExtensionsShowcase, InstalledExtensions}` — UI для просмотра/«управления» доступными расширениями кооператива. Данные подтягивает из coopback (AppRegistry → GraphQL).
- `components/desktop/src/pages/Marketplace/*` — это **Стол заказов** (Marketplace MVP, другое), путать нельзя.

### 1.2. Backend (controller / coopback)

- `components/controller/src/extensions/extensions.registry.ts` — `AppRegistry: INamedExtension` хардкодит NestJS-модули всех расширений (`soviet`, `chairman`, `capital`, `chatcoop`, `participant`, `powerup`, `reports`, `1ccoop`, `qrpay`, `sberpoll`, `yookassa`, `builtin`).
- Поля `IRegistryExtension`: `is_builtin`, `is_internal`, `is_available`, `desktops`, `external_url`, `title`, `description`, `image`, `class` (NestJS-модуль), `pluginClass` (миграции), `schema` (Zod конфига), `tags`, `readme`/`instructions` (async чтение README/INSTALL.md из директории).
- Концептуально это уже **полу-«пакетная»** модель: есть метаданные пакета, бинарь (тут — компилируемый внутрь monorepo), миграции, конфиг-схема. Просто всё in-process, без выгрузки и pull-tarball.
- Видимость и онбординг столов решает слой grants (см. memory `reference_extension_onboarding_gating`): backend через `getDesktop` отдаёт `DesktopWorkspace.grants`, фронт сверяет `meta.requires`.

### 1.3. On-chain (apps contract)

- Развёрнут в подсетях, в которых живёт Mono (на mono-ai-5 — chain_id `db79c84096…`). 17 actions / 8 tables — pricing, releases, subs, packages, coops, clients, globals.
- Source of truth для **внешнего** каталога; native extensions on-chain пока не существуют.

### 1.4. Apps-catalog (внешний сервис)

- Репозиторий `C9S/apps-catalog`, ветка `dev`. ca-auth (npm-pull-proxy) + ca-admin (publisher control) + Nexus + Postgres. Связь с mono — через `KE_RPC_URL=node:8888` и `MONO_BACKEND_URL=coopback:2998` (docker DNS `mono-shared` сеть).
- Концепция: tenant-кооператив (`romashka`, `voskhod`) → подключается → подписывается на пакет → ca-auth раздаёт tarballs из Nexus только когда on-chain `subs[tenant][package]` активна.

## 2. To-be: целевая модель

Цель — **два класса пакетов** в одном каталоге, разделённые по типу доставки:

| Класс | Доставка | Жизненный цикл | Примеры |
|---|---|---|---|
| **bundle** | Компилируется в SSR-bundle desktop'а / NestJS-модуль coopback'а. Не качается из Nexus. | Версия = версия mono. Обновляется через `git pull && pnpm build`. | Сегодняшние 7 native: soviet, chairman, capital, … |
| **remote** | tarball в Nexus → ca-auth pull-proxy → dynamic import. NestJS-модуль динамически грузится в coopback. | Версия = `setrelease` on-chain. Обновляется без передеплоя mono. | Будущие: новые специализированные столы, форки текущих, частные пакеты кооперативов. |

**Каталог отображает оба класса одинаково** в UI (`ExtensionStore`); внутри строки пакета — поле `kind: bundle | remote`. Для `bundle` кнопка «Установить» скрыта/заменена на «Уже установлено», для `remote` — реальный install-flow через подписку + pull.

## 3. Промежуточный слой совместимости (dual mode)

### 3.1. Регистрация bundle-пакетов в каталоге как «pre-installed»

**Минимальный шов** на стороне apps-catalog:
- Добавить на on-chain контракт `apps` (или в admin-проекцию ca-admin) **флаг bundle** или отдельную таблицу `bundled_packages[coopname, package_id, mono_version]`. Запись означает: «этот кооператив получает пакет в составе bundle Mono, в каталоге показываем как already-installed, подписки не требуем».
- ca-auth при запросе на pull проверяет: bundle → отказ с понятной ошибкой (или редирект на «уже встроено»).

**Источник истинности — каталог**, не Mono:
- Mono при старте `useInitExtensionsProcess` помимо bundle-загрузки **посылает в ca-admin** список своих bundled-пакетов (POST `/v1/admin/bundled-packages/sync` с api-key или mTLS).
- ca-admin записывает их с `kind='bundle'` и `compatible_subnets=[mono.chain_id]`.

**Регистрация bundle-пакетов в каталоге** — однократная (idempotent на mono_version + chain_id), не требует Nexus-репозитория.

### 3.2. Маркировка native extension'ов в коде

В каждом из 7 extension'ов завести **manifest-файл** (mirror к [apps-catalog/libs/core/manifest/package-manifest.schema.ts](../../../../apps-catalog/libs/core/manifest/package-manifest.schema.ts)):

```jsonc
// components/desktop/extensions/soviet/package.json
{
  "name": "@coopenomics/soviet",
  "version": "0.1.0",
  "catalog": {
    "kind": "bundle",
    "title": "Стол Совета",
    "icon": "fa-solid fa-gavel",
    "workspaces": ["soviet"],
    "roles": ["chairman", "member"],
    "mono_min_version": "0.0.0"
  }
}
```

Скрипт `tools/sync-bundled-packages.ts` собирает все 7 manifest'ов + chain_id + mono version → POST в ca-admin.

### 3.3. Динамическая загрузка (для remote-класса)

**Frontend:**
- Расширить `extensionsRegistry` чтобы значения могли быть `() => Promise<IWorkspaceConfig[]>` (как сейчас, bundle) **или** `{ kind: 'remote', tarballUrl, version }` — резолвер сам качает tarball через ca-auth proxy, распаковывает в Quasar Boot-script хранилище, dynamic-import'ит `install.ts` из распакованного бандла, кэширует.
- Vue Router добавление routes остаётся то же (`router.addRoute('base', r)`).

**Backend (coopback):**
- Аналогично — `extensions.registry.ts` принимает динамические записи. При первом запросе кооператива на remote-package coopback:
  1. Через `MonoBackendPort` (либо прямой HTTP к ca-auth) проверяет подписку on-chain.
  2. Качает tarball через ca-auth (с JWT кооперативного backend'а).
  3. Распаковывает в `/var/lib/coopback/extensions/<package>@<version>/`.
  4. `dynamic import` ESM-модуля; регистрирует Module через NestJS dynamic module pattern (тот же паттерн, что у текущих PluginModule).

**Изоляция:** для безопасности — sandbox через VM2/Workers или хотя бы хеш-проверку tarball'а (Nexus отдаёт SHA-256, on-chain `releases` фиксирует ожидаемый hash).

### 3.4. Coexistence rules

- Один и тот же `package_id` не может одновременно быть `bundle` и `remote` для одного кооператива. Если on-chain появилась подписка на `@coopenomics/soviet` (remote), а в bundle есть тот же package_id — **bundle wins** до явного выключения через `bundled_packages.disabled_at`.
- Когда extension мигрирует из bundle → remote (см. п. 4): сначала выпускается `remote` версия в каталог, тестируется на одном пилоте, потом `disabled_at` ставится в `bundled_packages` Mono'а, и bundle-fallback гасится.

## 4. План миграции по extension'ам (поштучно)

| Extension | Сложность | Зависимости | Кандидат №… |
|---|---|---|---|
| **chatcoop** | низкая — изолированный чат-стол, минимум интеграции с core | core ws-bridge, member-info | **№1 (пилот)** |
| **reports** | низкая-средняя — read-only отчёты | analytics endpoints | №2 |
| **powerup** | средняя — затрагивает ledger | wallet | №3 |
| **chairman** | высокая — связан с onboarding + agreements | grants, agreements | №4 |
| **soviet** | высокая — управление повесткой совета, on-chain actions | proposals, agreements | №5 |
| **participant** | высокая — base extension для пайщика | accounts | №6 |
| **capital** | максимальная — финансовые операции, capital_issues | ledger2, time-tracking | №7 (последний) |

Каждая миграция = отдельная story в apps-catalog репозитории (Epic 9 в дополнении), parallel — story в mono (вытаскивание extension'а в отдельный pnpm-workspace пакет + tarball-сборка через `pnpm publish` в Nexus).

## 5. Bootstrap-пакет

Для подтверждения трубы — `@voskhod/test-app`:
- Сегодня уже зарегистрирован через POST `/v1/admin/package` (smoke-стенд, request_id `98b1d8ac-…`).
- В рамках Bootstrap-стори:
  - Сгенерировать минимальный tarball (1 page, 1 route) с `package.json` манифестом.
  - `npm publish --registry=http://ca-auth:3001/v1/registry/` (с tenant JWT кооператива voskhod).
  - `apps::setrelease` on-chain.
  - Проверить, что desktop'у через `loadExtensionRoutes('@voskhod/test-app')` action раздаёт routes из remote tarball.

Bootstrap не претендует на «настоящий» сценарий — это инфра-проверка трубы для последующей реальной миграции (Кандидат №1 = chatcoop).

## 6. Открытые вопросы

1. **Где живёт `package_id` для bundle?** Предложение: `@coopenomics/<name>` (org scope = монорепозиторий). Если кооператив хочет форкнуть — он публикует под своим scope `@voskhod/<name>` с другим bundle'ом.
2. **Можно ли остановить bundle-загрузку extension'а в Mono per кооператив?** Сегодня bundle грузится всегда; видимость регулируется backend grants. То есть мы можем ВЫПИЛИВАТЬ extension из bundle и заменить на remote — но не для одного кооператива из десяти. Возможный путь — feature-flag через ENV на инстансе mono (один Mono = один кооператив сегодня).
3. **Sandbox для remote-модулей.** Без изоляции remote-extension с правами NestJS-модуля = админ-доступ к coopback. Нужен или подписанный паблишер (allowlist on-chain `apps::pubpub`), или VM2-sandbox, или статический анализ tarball'а перед запуском.
4. **Миграции схемы БД для remote-extension.** Сегодня `pluginClass.runMigrations(schema)` запускается на старте монолита. Для remote — нужен hook на «новый extension установлен» с автоматическим прогоном миграций. Open question: что если миграция падает? Откат subscription on-chain невозможен (releases immutable).
5. **Версия Mono ↔ совместимость extension'а.** `catalog.mono_min_version` в манифесте; ca-admin при `setrelease` проверяет совместимость с активной mono_version подсетей `compatible_subnets`.
6. **UX миграции для уже-установленных native.** Когда extension переезжает bundle → remote, пользователь должен:
   - Увидеть в каталоге, что обновлена доставка (info badge «теперь обновляется отдельно»).
   - НЕ потерять данные / config (миграция identifiers in БД).
   - Иметь fallback на bundle, если remote tarball недоступен (offline mode).

## 7. Что НЕ входит в этот research

- Конкретный код миграции какого-либо extension'а (это будут отдельные stories).
- Решение об IDE/sandbox/изоляции — это отдельное исследование безопасности.
- Дизайн UI «магазина» в ExtensionStore (мы переиспользуем существующие страницы, только добавляем kind/version поля).
- Pricing / биллинг внутри Mono — каталог уже это решает (контракт apps + ca-admin).

## 8. Решение V1: не мигрируем, делаем демо-пилот

**Утверждено 2026-06-02.** Native extensions трогать не будем. Вместо bundle→remote миграции собираем минимальное демо-приложение, ставим его сами как внешний разработчик и проводим полный цикл с оплатой. Это снимает риски с native и подтверждает контур end-to-end.

### Решения по содержанию пилота

| Тема | Решение | Замечание |
|---|---|---|
| Что делает demo-app | Вариант A — пустой Hello-стол с одним роутом + иконкой | Минимум контента, максимум инфра-трубы |
| `package_id` | `@voskhod/demo-app` | scope = coopname-разработчик |
| Разработчик (`owner_username`) | `voskhod` (кооператив-аккаунт) | Публикует **chairman voskhod** через `@active` |
| Pricing | `default` = **1000 RUB / месяц** prod / **60 сек dev** | period в `globals.min_payment_period_seconds` |
| Trial | **15 минут** в dev (нет prod-trial в V1) | `globals.lead_time_seconds=900` |
| Покупатель-пилот | `partner1` (поднимается через `pnpm boot:extra` в mono-ai-5) | Та же цепь voskhod'а, не отдельная chain |
| Self-subscription (voskhod) | Видит свой demo-app, подписывается без оплаты | Bypass: если `tenant_coop == package.owner_coop` → charge skip |
| Кэш tarball'ов | Без кэша — каждый desktop boot качает заново | Простой sync-loop, без storage |
| UI магазина | Переиспользуем `pages/ExtensionStore` (минимальные правки) | Добавляем поле `kind=bundle\|remote` |
| Стол разработчика | **Новый bundle-extension `developer`**, виден только chairman'у оператора | UI публикации + список подписчиков + pricing |

### Инфра для одновременной работы двух кооперативов

Сценарий «оператор-разработчик ↔ кооператив-потребитель» требует двух **независимых UI-окружений** в одной dev-машине:
- voskhod's desktop+coopback — на mono-ai-5 (`COOPNAME=voskhod`, порты 3038/3039).
- partner1's desktop+coopback — поднимаем **через docker-compose overlay в apps-catalog** (`COOPNAME=partner1`, порты 3048/3049), указывающие на ту же node mono-ai-5:8930 (`CHAIN_URL=http://node:8888`).
- Никакой второй chain не нужен. partner1 активируется на воскод-цепи через `pnpm boot:extra` (`mono-ai-5/components/boot/src/init/infra.ts:584`).

Это компромисс: coopback/desktop single-coopname остаются как есть, multi-tenancy откладываем.

## 9. Epic 9 «MVP demo-app pilot E2E»

Зонтичный эпик. Параллельная работа в двух репозиториях:
- **apps-catalog** — `examples/demo-app/`, overlay для partner1, self-sub bypass, dev-seed.
- **mono-ai-5** ветка `apps-catalog` — стол разработчика, remote-loader в init-installed-extensions, минимальные правки ExtensionStore.

### Stories

**9.1 examples/demo-app/ в apps-catalog**
- Скаффолд: `package.json` с `catalog.kind=remote, workspaces=['demo']`, `install.ts` с одним IWorkspaceConfig (стол «Demo», роут `/:coopname/demo` с Hello-страницей).
- Builder: `pnpm pack` → `demo-app-0.1.0.tgz`.
- README с инструкцией публикации.

**9.2 docker-compose.partner1.overlay.yml в apps-catalog**
- Overlay для dev-stack: `coopback-partner1` (порт 3048, COOPNAME=partner1, MONGO_PARTNER1_DB), `desktop-partner1` (порт 3049, тот же coopback-partner1).
- Подключение к `mono-shared` сети с aliases.
- Скрипт `pnpm dev:stack:up-partner1` поднимает overlay поверх базового.
- Документация: «партнерский desktop по `http://localhost:3049`, входить как admin partner1 (WIF из docs-harness/state/cooperatives/partner1.json)».

**9.3 Стол Разработчика в mono (`extensions/developer`)**
- Bundle-extension в `components/desktop/extensions/developer/`:
  - install.ts: workspace `developer`, роуты «Мои пакеты», «Опубликовать релиз», «Подписчики», «Pricing».
  - Виден только chairman'у кооператива-оператора через `meta.roles=['chairman']` + grants на бэкенде.
- Backend модуль `controller/src/extensions/developer/`:
  - Поднимается в `AppRegistry` как `is_internal=true, is_available=true`.
  - GraphQL: `myPackages`, `publishPackage`, `setReleasePricing`, `packageSubscribers`.
  - Делегирует в ca-admin через HTTP с админ-ключом.
- Self-sub bypass: «У вас уже доступ как разработчику» (без отдельной кнопки).

**9.4 Remote-loader в `processes/init-installed-extensions`**
- После bundle-pass — запрос в coopback `getInstalledRemotePackages(coopname) → [{package_id, version, tarballUrl}]`.
- Для каждого: pull tarball через ca-auth pull-proxy с JWT кооператива.
- Распаковка в памяти (не на диск — без кэша).
- `Function('return ' + installSource)()` или dynamic `eval` install.ts → `IWorkspaceConfig[]` → `router.addRoute('base', ...)`.
- Ошибка на одном extension'е не валит остальные (try-catch вокруг каждого).

**9.5 pages/ExtensionStore: поле `kind` + новые кнопки**
- Расширить DTO ответа `extensions catalogList` полями `kind: 'bundle'|'remote'`, `version`, `pricingRubPerMonth`, `isSelfOwned`.
- `kind=bundle` → «Уже установлено».
- `kind=remote && isSelfOwned` → «Доступно как разработчику» (без оплаты).
- `kind=remote && !isSelfOwned && !subscribed` → «Подписаться 1000 RUB/мес».
- `kind=remote && subscribed` → «Активная подписка до DD.MM».
- Резолвер дёргает coopback'овский новый endpoint, который ходит в ca-auth `GET /v1/registry/packages`.

**9.6 Self-subscription bypass в pricing-watcher**
- В `apps-catalog/apps/ca-admin/src/modules/pricing-watcher/application/request-charge.use-case.ts`:
  - Перед cadence-check — проверка `tenantCoopname === packageOwnerCoopname`.
  - Если match → outcome=`'skip-self-subscription'`, sub продлевается через `extendsub` без charge.
  - Audit-log: `pricing.self_subscription_skipped` с `package_id` + `coopname`.
- Тест: `request-charge.use-case.spec.ts` — voskhod подписан на свой `@voskhod/demo-app` → tick → no charge, sub.end_at += period.

**9.7 dev-seed: globals + pricing**
- Скрипт `apps-catalog/scripts/seed-dev-pricing.ts`:
  - `apps::setglobals` `lead_time=900`, `min_payment_period=60`, `retry_max=3`.
  - `apps::setpricing @voskhod/demo-app default plan {RUB 1000}`.
- Запускается из `dev:stack:up`.

**9.8 E2E smoke test demo-app pilot**
- Скрипт `test/e2e/demo-app-pilot.sh`:
  1. Поднимаем стенд + partner1 overlay.
  2. chairman voskhod публикует через стол разработчика → `apps::regpkg` + tarball в Nexus + `apps::setrelease`.
  3. partner1 admin подписывается через `pages/ExtensionStore` → `apps::regsub`.
  4. Ждём 70 секунд (один pricing-watcher тик) → проверка `apps::charge_intents` появилась запись → `extendsub` прошёл.
  5. Перезагрузка `desktop-partner1` → remote-loader тянет tarball → стол «Demo» в drawer'e.
  6. `apps::cancelsub` → следующий тик → стол исчезает.
- Pass criteria: все 6 шагов зелёные.

### Order of execution

```
9.1 (examples/demo-app)            ──┐
9.2 (partner1 overlay)              ─├─→ 9.7 (dev-seed) ─→ 9.8 (E2E smoke)
9.6 (self-sub bypass в ca-admin)   ──┘                       ↑
                                                              │
mono-сторона:                                                 │
9.3 (стол разработчика) ─→ 9.5 (ExtensionStore) ─→ 9.4 (remote-loader) ─┘
```

Все mono-stories идут в зонтичный PR `apps-catalog` → dev в mono'е (один PR на эпик).
Все apps-catalog-stories идут в зонтичный PR `feat/E9-demo-app-pilot` → dev в apps-catalog.

### Не входит в Epic 9

- Реальная миграция native extensions (отложена на Epic 10+).
- Sandbox-изоляция remote-модулей (Epic 11, открытый вопрос #3).
- Production-pricing с реальным RUB-токеном / реальным биллингом — V1 крутит in-chain RUB-like asset.
- Multi-tenancy coopback'а (отложена; в V1 = два отдельных coopback'а).
