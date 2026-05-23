# mono (coopenomics/mono) — рабочие заметки

Этот файл — общая память агента для пяти чекаутов: `~/mono-ai-1`..`~/mono-ai-5`. Реальный файл лежит в `mono-ai-1/CLAUDE.md`, остальные четыре — симлинки сюда; правки коммитим из mono-ai-1 в ветку `dev`.

## Стек монорепы

| Слой | Где | Технология |
|------|-----|------------|
| Backend (coopback) | `components/controller/` | NestJS 10, TypeScript, TypeORM, GraphQL, EventEmitter2 |
| Frontend (UI пайщика) | **`components/desktop/`** | **Vue 3 + Quasar** в SSR-режиме (`quasar dev --mode ssr`) |
| Контракты | `components/contracts/` | EOSIO/CDT, C++ |
| SDK для frontend | `components/sdk/` | TypeScript, авто-генерится из controller GraphQL schema |
| Parser blockchain | `components/parser/` | TypeScript |
| Boot/orchestration | `components/boot/` | TypeScript |

**Frontend (`components/desktop/`) — FSD структура:** `src/{app,pages,processes,widgets,features,entities,shared,stores,desktops,boot}/`.

Когда план говорит «UI компонент» / «frontend integration» — путь `components/desktop/src/{features|widgets|pages|processes}/<name>/`, расширение `.vue` (composition API + `<script setup lang="ts">`), стили Quasar (QChip/QBtn/QCard/QDialog…), GraphQL через Apollo Client + сгенерированные типы из `components/sdk/`. Dev — `pnpm --filter @coopenomics/desktop run dev` или `devnet` (без SSR).

**НЕ путать:** НЕТ `components/app-cooperative/` — не предлагать. Все frontend-сессии работают в той же монорепе, что и backend. В стеке **никакого React нигде нет**.

## Worktree-политика

**Для mono-ai-4 (базовая ветка `marketplace2`, Стол заказов):** **worktree приветствуется** — изоляция работ + параллельные ветки. Если worktree пуст от `node_modules` и `.env` (pnpm их не дублирует):

```bash
WT=/home/admin/mono-ai-4/.claude/worktrees/<name>
ln -s /home/admin/mono-ai-4/node_modules $WT/node_modules
ln -s /home/admin/mono-ai-4/components/controller/node_modules $WT/components/controller/node_modules
ln -s /home/admin/mono-ai-4/components/controller/.env $WT/components/controller/.env
```

Аналогично для других пакетов, чьи тесты будут запускаться (`components/desktop/node_modules`, `components/sdk/node_modules`). `jest` из bin: `cd $WT/components/controller && ./node_modules/.bin/jest -i <test>` — корректно резолвит ts-jest и подхватывает `.env`.

**Подвох cooptypes:** когда `controller/node_modules` — симлинк на main, пакет внутри `node_modules/cooptypes -> ../../cooptypes` раскрывается **относительно main checkout**. `import { MarketContract } from 'cooptypes'` тянет d.ts из main, не из worktree. Если worktree обновлён, а main позади — TSC падает на отсутствующих типах. **Фикс:** перед TSC в worktree controller'а — `git pull` в main checkout до того же коммита (или хотя бы где cooptypes/src синхронен) + `pnpm build` в `main/components/cooptypes/`.

## PR-flow

**Базовая ветка mono-ai-1 — `dev`.** Прямые коммиты в `dev` для мелких фиксов разрешены и не требуют feature-ветки/PR (отменено 2026-05-22 пользователем). Для крупных задач — feature-ветка (`feat/...` или `fix/...`) от dev и PR в dev; merge делает пользователь на GitHub. Push в `main` / `mvp` — по-прежнему только через PR.

**Не stash'ить `-u` при unstaged WIP пользователя.** Это создаёт окно для потери при drop/конфликте. Если нужно временно убрать unstaged — `git stash push -- <конкретные-paths>` либо коммит-в-feature, и только свои файлы. Кейс 2026-05-18: после `git stash -u`+`drop` при конфликте потерял WIP пользователя (infra.ts/config.ts/quasar.config.cjs и др.).

### Story-by-story для проекта «Стол заказов» (mono-ai-4 на marketplace2)

Каждая story из MVP-эпиков «Стол заказов» (`coopenomics/mono`, базовая ветка `marketplace2`, чекаут `~/mono-ai-4`, BMad-spec'и `_blago/.../components/3-minimalnyy-produkt/_bmad-output/`) идёт через PR.

Workflow:
1. Worktree от `marketplace2` на feature-ветке `feat/<E>-<S>-<slug>`.
2. Edits + unit-тесты; tsc + jest должны быть зелёные.
3. Commit + push feature-ветку.
4. `gh pr create --base marketplace2 --head feat/<E>-<S>-<slug>`.
5. Merge **пользователем на GitHub** (не вызывать `gh pr merge` без явной просьбы).
6. После merge — fetch + checkout marketplace2 в основной чекаут, удалить feature-ветку + worktree, запустить e2e / blockchain тесты против обновлённого marketplace2.

### Umbrella-PR на эпик vs цепочка PR

При работе story-by-story в одной feature-area **не плодить отдельные PR на каждую story с одинаковой целевой веткой**. Каждый последующий PR показывает кумулятивный diff (всё, что в head минус то, что уже мёрджнуто в base). Если предыдущие PR ещё не смерджены — в diff вылазят дубликаты файлов всех предыдущих stories.

**Default — umbrella-PR на эпик** (для крупных эпиков с >3 stories): одна `feat/<E>-epic` ветка + один PR; каждая story — отдельный коммит. Worktree последовательно, push после каждой story, PR обновляется. Так закрыт Эпик 1 Стола заказов (umbrella #380).

**Альтернатива — stacked-PRs с `base:<prev-feat>`:** каждый PR таргетится на предыдущую feature-ветку. После merge нижнего GitHub автоматически перетарджетит верхние. Требует дисциплины и тулинга.

**Анти-паттерн:** worktree от `feat/1-2-...`, потом от `feat/1-3-...`, и каждый PR в `marketplace2`. Цепочка branches правильная (изоляция), но цепочка PR — нет. Кейс Эпика 1 Стола заказов 2026-05-14: 11 PR `#370-#380` подряд от `marketplace2`, каждый +N stories назад. Пользователь дошёл до review #372 и обнаружил дубли. Закрыл #372-#379, оставил только #380.

## Локальные тесты

**Не запускать полный jest локально** ни в mono-ai-1, ни в mono-ai-4: живой dev-стек в docker (`nodeos`, `controller dev` nodemon, `parser dev`, `n8n`) вешает CPU/RAM и блокирует chain. Полный suite — задача CI после push'а PR.

В mono-ai-4 **запрещён параллельный режим jest** (worker-pool по умолчанию) — это вешает сервер. Если нужен unit-тест — точечный с `--runInBand`:

```bash
pnpm jest tests/unit/marketplace/marketplace-onboarding-service.test.ts --runInBand
```

`pnpm generate-schema` / `pnpm generate-client` — **не запускать локально**; та же memory/CPU полка вешает контейнер controller'а. Либо CI, либо пользователь сам когда контейнер остановлен.

Перед коммитом достаточно `tsc --noEmit` (быстрый, не блокирует).

## SDK login canon

`@coopenomics/sdk` экспортирует `Client.create({api_url, chain_url, chain_id})` + метод `client.login(email, wif)`. Он сам:
1. Генерит `now` (ISO timestamp).
2. Подписывает приватным ключом (WIF) через eosjs.
3. Зовёт `Mutations.Auth.Login.mutation` с `{email, now, signature}`.
4. Возвращает `{tokens: {access: {token}, refresh: {token}}, account: {username}}`.

**Не дёргать `Mutations.Auth.Login` напрямую** — `LoginInput` ждёт `{email, now, signature}`, генерация подписи внутри SDK Client. Refresh: `Mutations.Auth.Refresh.mutation` с `{access_token, refresh_token}`. Канон используется в `blago-cli/src/session/index.ts` (loginInteractive) и в EMP-коннекторе `connectors/cooperative-tsk-login-connector` (Story 11.5).

## Backend (controller) каноны

### 3 базовые роли — User / Member / Chairman

- **User** — обычный пайщик. Базовые потребительские права (заказывать, публиковать оферту, видеть свои данные).
- **Member** — **член совета** (не «член кооператива»!). User-права + read-only admin (видит склад, поток заказов, повестку — но не модерирует и не подписывает финальные действия).
- **Chairman** — председатель. User + admin (модерация, KU/whitelist/витрины, closing signature АПП-приёмки/выдачи, повестка совета на write).

Маппинг core-роли на extension-роль явно: User → orderer + опционально offerer/operator; Chairman → admin (полный write); Member → read-only admin (board_readonly). Пайщик может быть одновременно в нескольких extension-ролях — массив, не enum. Guard'ы в расширениях — локальные сейчас, в Phase 2 переключатся на платформенный CASL.

### `agreements` ссылается на существующий document registry_id

Когда расширение controller'а (marketplace, blagorost, любое следующее) хранит факт подписи документа пайщиком в глобальной on-chain таблице `agreements`, ссылка идёт через **существующий `registry_id` из платформенного реестра документов**, не через отдельный type-string типа `marketplace.cpp.stol-zakazov-v1`.

Поле `document_id` в `agreements` — FK на существующий platform registry. Extension-таблицы `*_onboarding_requirement` — `document_registry_id` ссылается на существующий ID. API запросов вида «какие документы подписаны member'ом» — `agreementsByMember(member_id, document_id_filter=[...])`.

**Технический долг платформы:** «Договор УХД сейчас не проходит через `agreements`» — отдельная задача core controller'а, вне scope конкретных расширений.

### Трёхуровневый онбординг расширений

Платформенный паттерн, обязателен для всех новых расширений controller'а.

**L1 — Кооператив (one-time):** председатель/совет принимает решение совета о подключении ЦПП, принимается положение ЦПП (статический документ из platform registry, через document factory с подстановкой параметров кооператива), оферта регистрируется в `coop_registration_offers_registry`.

**L2 — Пайщик при вступлении (per-membership):** в registration-flow появляется **выбор** ЦПП. Пайщик отмечает интересующие, document factory рендерит оферту с `{cooperative_params, member_params, agreement_date}`. Подпись пишется в глобальную on-chain `agreements`. Эта подпись **нивелирует** gate на столе расширения.

**L3 — Пайщик на рабочем столе (per-extension first visit):** backend проверяет через `agreementsByMember` — подписана ли оферта ЦПП. ДА → gate не показывается. НЕТ → gate показывается как explicit consent.

При проектировании любого нового расширения — обязательно три истории под три уровня. На MVP допустимо упростить: одинаковый `document_registry_id` для положения и оферты (физически разные документы могут быть в Phase 2).

### Marketplace asset через DI

В сервисах `components/controller/src/extensions/marketplace/**/*.service.ts` запрещён хардкод вида `const ASSET_DECIMALS = 4` / `const ASSET_SYMBOL = 'RUB'`. Decimals и symbol — через DI `MARKETPLACE_ASSET_CONFIG`:

```ts
@Inject(MARKETPLACE_ASSET_CONFIG) private readonly assetConfig: MarketplaceAssetConfig
// assetConfig.symbol, assetConfig.decimals
```

Канон-пример: `marketplace-order-create.service.ts`. См. `marketplace-asset.config.provider.ts` — мапит `config.blockchain.root_govern_symbol` / `root_govern_precision`. Разные среды (mainnet/testnet/dev) имеют разный symbol+precision.

### registry_id=800 (ReturnByAssetStatement) — клиринг, не членские взносы

Marketplace в монорепе живёт в **двух контурах**:
1. **Система клиринга** (старый, не используется) — registry_id=800. Не использовать в новых фичах.
2. **Система членских взносов** (текущий MVP) — документы лежат **рядом** с актами приёма-передачи и ТТН; другая группа registry_id.

Для нового документа Marketplace-членские-взносы: завести новый registry_id рядом с актами/ТТН и проложить цепочку `cooptypes → factory → controller → desktop`:
1. `@coopenomics/cooptypes`: новый тип документа + регистрация в registry.
2. `@coopenomics/factory`: generator (preview-структура + meta).
3. `@coopenomics/controller`: signed-document DTO + verify в сервисе.
4. `@coopenomics/desktop`: подпись через `Classes.Document` с новым registry_id.

## GraphQL каноны (controller + desktop)

### Описания @Field — бизнес-языком

В `@Field({ description })`, `@InputType`, `@ObjectType` нельзя писать «Story 4.1», «Эпик 3», «FR11a», «composite-entity», «dispatch pipeline», «tx_snapshot», «backend deterministic order_hash». Только пользовательский язык: «Идентификатор заказа», «ПВЗ получения», «Кол-во единиц товара». Story-ссылки и инвариант-комменты — только в inline-комментариях внутри сервиса.

### Enum вместо строковых литералов

Запрещены `if (offer.cycle_type === 'volume_based')`, `status: 'ACTIVE'`, `'PENDING_MODERATION'`. Любое поле с фиксированным набором (cycle_type, status, type, kind, role) — TypeScript `enum`, при необходимости `registerEnumType` для GraphQL. В тестах константы — тоже из enum, не дублирующие строки. Перед добавлением сравнения по строке — `enum MarketplaceOfferCycleType` / `MarketplaceOrderStatus` в `domain/entities/*.types.ts`.

### Пагинация — единый паттерн

В controller-resolver'ах пагинация делается единым каноническим паттерном:
- Вход: `@Args('options', { nullable: true }) options?: PaginationInputDTO` (импорт из `~/application/common/dto/pagination.dto.ts`, поля page/limit/sortBy/sortOrder).
- Выход: `createPaginationResult(ItemDTO, 'PaginatedXxx')` + сигнатура `Promise<PaginationResult<T>>` (items / totalCount / totalPages / currentPage).
- Repository принимает `PaginationInputDTO`, сам считает offset/limit/sort через TypeORM `findAndCount`.

Канон: `time-tracker.resolver.ts`, `expenses-management.resolver.ts`, `generation.resolver.ts`. Никаких локальных `{ limit, offset }`.

### Никаких raw GraphQL-строк в desktop

В `components/desktop/src/pages/**/api/index.ts` и аналогах запрещены конструкции:
```ts
const QUERY = `query Foo { ... }`;
await sendPOST('/v1/graphql', { query: QUERY, variables });
```
Даже с комментарием «техдолг до Zeus regen».

Обязательная процедура перед UI-кодом под новую GraphQL-операцию:
1. Добавить/изменить DTO/resolver в `components/controller/src/...` (code-first).
2. `pnpm run generate-schema` в `components/controller/` → пересоздать `controller/schema.gql`.
3. `pnpm run generate-client` в `components/controller/` → graphql-zeus кладёт клиент в `components/sdk/src/zeus/`.
4. `pnpm run build` в `components/sdk/` → unbuild собирает `dist/`.
5. В desktop импортировать `Mutations.<Domain>.<Name>` / `Queries.<Domain>.<Name>` из `@coopenomics/sdk` — типизировано end-to-end.

Если на шаге 1 не хватает поля — добавить и запустить весь цикл; не оставлять заглушку «пока».

### Строгая типизация desktop API из SDK через IInput['data']

Каждый вызов `client.Mutation` / `client.Query` в `components/desktop/src/**/api/index.ts`:
1. Принимает аргументом объект `data: IXxxInput`, где `IXxxInput = Mutations.<Domain>.<Action>.IInput['data']` (или `Queries...`) — тип берётся **прямо из @coopenomics/sdk**, не переописывается.
2. Передаёт в `variables` объект `data` целиком: `{ variables: { data } }`. Запрещено разворачивать поля: `{ variables: { data: { a, b, c } } }`.

Канон — `features/Branch/CreateBranch/{api,model}/index.ts`: тип в model `export type IXxxInput = Mutations.X.Y.IInput['data']`; функция в api `function (data: IXxxInput) { ... variables: { data } }`. Не делать `as` cast'ов.

## Frontend desktop — English имена

В `components/desktop/` и любом Vue/TS frontend коде **все имена идентификаторов — английские**:
- Имена Vue-компонентов: `BaseInput`, `BaseDialog`, `WalletCard`, `IdentityPanel`.
- Имена файлов и директорий: `shared/ui/BaseInput/BaseInput.vue`.
- CSS-классы: `.base-card`, `.wallet-card__icon`, `.id-panel__hero`.
- SCSS-переменные: `$primary`, `$prog-blagorost`, `$separator-color`.
- TS-типы, интерфейсы, переменные, функции: `interface WalletCardProps`, `function useWalletData()`.

**Why:** Unicode-имена ломают тулчейн (Vite/Webpack резолверы и aliases часто на ASCII-only regex; TypeScript symbol-resolution на не-ASCII нестабильно; ESLint `vue/component-name-in-template-casing` ждёт PascalCase ASCII; импорты `import БазоваяКнопка from '@/shared/ui/БазоваяКнопка'` невыносимы при review).

**Заголовки в .vue, label-ы кнопок, тексты в UI — по-русски** (это user-facing strings). Не путать с правилом «онтологические class_id по-русски» — то про EMP/ТЭМ и blago-документы, не про frontend.

**Кейс 2026-05-18:** при подготовке UX-спецификации для components/desktop ошибочно применил правило русских имён к Vue-компонентам (`БазоваяКнопка`, `БазовоеПолеВвода`); пользователь поправил.

## Стандарты процессов (.standard.yaml) — бизнес-языком

`components/contracts/cpp/**/*.standard.yaml` — документация для методолога/бухгалтера, не для разработчиков контракта. В `purpose`, `description`, `note`, `human` запрещены технические термины:

- никаких «callback», «soviet::exec», «soviet::createagenda», «AUTHORIZE_CALLBACK_SIGNATURE», «type-string», «registry N», «proposed расширение enum'а»;
- никаких «backend formирует», «controller вызывает», «contract отдаёт» — пишем кто что делает на уровне бизнеса (председатель / совет / заказчик / поставщик);
- технические `marketplace::propwroff`-имена в полях `action`/`name`/`triggered_by` оставляем как identifier'ы, но всё человеко-читаемое в `human`/`purpose`/`description` — на бизнес-словаре;
- бухгалтерские проводки `Дт 91 / Кт 10` — допустимы (бухгалтер их понимает);
- если процесс встроен в более общий — ссылаемся на стандарт по имени-человеку («типовой процесс решения совета»), не на техническую реализацию повестки.

Эталоны: `p.mkt.return.standard.yaml`, `p.cap.rid.standard.yaml`, `reg.coop.standard.yaml`. Антипример — `p.mkt.wroff.standard.yaml` в PR #399 review 2026-05-18 (был забит callback-описаниями и «type=mktwroff»).

## Vault & SERVER_SECRET

WIF админ-аккаунта (например `voskhod`) хранится в `vaults` PostgreSQL зашифрованным AES-256-CBC с ключом `sha256(SERVER_SECRET)`. Если `SERVER_SECRET` потом меняли — **старые записи разрушаются**, `decipher.final()` бросает `error:1C800064:Provider routines::bad decrypt`.

**Симптомы:**
- В логе coopback: `[VaultDomainService] Ошибка при получении WIF ключа для пользователя voskhod: bad decrypt`.
- В UI каскад `SignAgreementDialog` не закрывается; SPA отправляет `sendAgreement` корректно, но `wallet::signagree` on-chain не происходит.
- Следствие — `wallet::users[<coop>]` пуст, и любой последующий `is_can_transfer`/трансфер AXON падает на `Отправитель не является участником ЦПП кошелька`.

**Фикс:**
1. Достать живой WIF (для voskhod в dev — `5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3` из boot config.ini, signature-provider).
2. Шифрануть им current SERVER_SECRET (см. `controller/src/utils/aes.ts` — sha256(SECRET) → AES-256-CBC, IV 16 байт, формат `ivHex:cipherHex`).
3. `UPDATE vaults SET wif='...', updated_at=now() WHERE username='voskhod' AND permission='active';`.
4. Перезапуск coopback **не нужен** — он читает каждый раз.

**Дефолт всех mono-репозиториев — `SECRET`.** Если в каком-то `.env` стоит другое — девиация, не норма. Перед re-encrypt'ом vault'а ВСЕГДА сначала смотреть `~/mono-ai-1/components/controller/.env` (или соседнего) — это origin truth для SERVER_SECRET.

**Кейс 2026-05-18 (Эпик 0):** в `mono-ai-5/components/controller/.env` стоял `e2e-fixture-secret-DO-NOT-USE-IN-PROD`, а WIF voskhod в vaults был зашифрован оригиналом — `SECRET`. Фикс — откатить SERVER_SECRET к `SECRET` и подровнять provider'а.

## Capital — фиксы билетов времени (PR #387 merged 2026-05-15)

В `components/controller/src/extensions/capital/` была серия багов в распределении билетов времени, закрытая PR #387 в dev. Три бага:

1. **`recalcDoneEstimatesForContributorProject` / `applyExplicitEstimateToTimeEntries`** раздавал «общий остаток пула» `(estimate − total_committed) / N` всем creators, включая того, кто уже закоммитил. Фикс: личная доля `max(0, estimate/N − own_committed_estimate)` через общий helper `redistributeIssueEstimateEntries`.
2. **`commitTime` partial split** создавал committed-запись без `entry_type` и `estimate_snapshot` — БД по default'у писала `entry_type='hourly'`, что ломало последующий recalc (фильтрует только `entry_type='estimate'`). Фикс: явно копировать оба поля.
3. **`declineCommit` / `handleDeclineCommit`** меняли только `commit.status='declined'`, но не возвращали `time-entries` в `is_committed=false`. Часы оставались в `total_committed_hours`. Фикс: `revertEntriesForDeclinedCommit` через новые `findCommittedByCommitHash` / `revertCommittedEntriesByCommitHash`.

**При симптомах** «25 ч подтверждено непонятно откуда» / «доступные часы не вернулись после decline» / «парные коммиты на одну работу» — первый чек: `grep -c redistributeIssueEstimateEntries time-tracking.interactor.ts` в контейнере > 5. Если нет — деплой устарел. Если есть, но баг — посмотреть `entry_type` у committed-записей по issue: legacy записи из БАГ #2 могут до сих пор быть с `entry_type='hourly'` для split-результатов от estimate (видны по `commit_hash IS NOT NULL AND entry_type='hourly' AND estimate_snapshot IS NULL` на DONE-задаче с estimate>0). Чинятся UPDATE'ом `entry_type → estimate` с правильным `estimate_snapshot`.

**Legacy data caveat:** `capital_time_entries` с `entry_type='hourly'` + `commit_hash != NULL` могут быть как (а) настоящей hourly работой до установки estimate, так и (б) split-наследием БАГ #2. Различить: если у задачи `estimate>0` и `DONE`, и записи hourly от тех же creators что в estimate-долях — это (б), чинить.

**Edge-case дробных остатков:** при `estimate=2.5` и одном creator, после commit'а 2 ч (`Math.floor < 1` для остатка) остаётся 0.5 ч uncommitted estimate, который никогда не закоммитится. Либо ручной DELETE uncommitted остатка, либо изменить estimate на целое (но estimate в `capital_issues` — on-chain, через UI mutation, не DELETE'ом в БД).

## Стол Заказов MVP — текущее состояние

Проект `1-prilozhenie-stol-zakazov` в blago (coopname voskhod, hash `feabc749…3841f73`). Кооперативная закупка/распределение имущества участка (продукты, товары, услуги); пилот — Красногорск; цель 6 мес: 10 кооперативов / 1200+ пайщиков.

**Локация:** `~/blago/production/1-prilozhenie-stol-zakazov/`.

**Структура артефактов:**
- `_bmad-output/planning-artifacts/` (project-уровень): `prd.md`, `prd-validation-report.md`, `ux-design-specification.md`, `architecture.md` (status:complete 2026-05-12).
- **`components/3-minimalnyy-produkt/_bmad-output/planning-artifacts/epics.md`** (SoT для MVP) — `stepsCompleted=[1,2,3,4]`, `status: complete 2026-05-12`, 65 FRs → 11 эпиков → 57 stories. **НЕ создавать дубль на верхнем уровне `_bmad-output/planning-artifacts/`** — MVP-компонент имеет собственный bmad-output.
- `requirements/` (5 файлов): `04-brif`, `0b-protsessy`, `0f-prd`, `7e-uxui`, `d6-arkhitektura` — дубли _bmad-output (намеренно, см. правило о дублях BMad-артефактов в global memory).

**Locked Decisions L1–L9:**
- **L1:** порядок подписей АПП (приёмка поставщик→председатель финально / выдача председатель→заказчик финально).
- **L2:** `o.mkt.payout` baseline `Дт 86 / Кт 51` без счёта 60.
- **L3:** реверты исключены — compensating forward с собственным `operation_id`.
- **L4:** геокарта КУ обязательна на трёх столах; lat/lng в `PlaceDomainEntity`.
- **L5 / L9:** «Системный конструктор ЦПП» → реализован как трёхуровневый онбординг расширений (см. выше).
- **L6:** без отрицательного баланса в MVP (отменяет NFR-R5 PRD).
- **L7:** enum 10 кооп-категорий (овощи/фрукты, молочные, мясо, рыба, хлеб, бакалея, напитки, готовая еда, услуги, прочие).
- **L8:** двухслойная схема подписания — глобальная on-chain `agreements` (SoT) + локальные `*_onboarding_requirement`/`*_onboarding_state` per-extension.
- **L10/L11/L13:** consolidated request backend-only / cycle_type backend variation / pull-модель отчётности.

**Прогресс по эпикам (на 2026-05-15):**
- **Эпик 1** — MERGED в `marketplace2`: PR #368/#370/#371/umbrella #380.
- **Эпик 2 «Сеть ПВЗ»** — MERGED PR #381 (после rebase). Workspace `market-pvz`, KU details + Yandex geocoder, Zeus SDK.
- **Эпик 11 Story 11.1 (Ledger2 canonical actions)** — MERGED PR #375 на C++ стороне. **TS-сторона cooptypes НЕ закрыта**: `cooptypes/src/contracts/marketplace/actions/index.ts` экспортирует только LEGACY клиринговые actions, `interfaces/marketplace.ts` auto-generated из устаревшего ABI. **Блокер Эпика 4** — нужен отдельный pre-эпик PR `feat/S11-1-cooptypes-canonical`: ABI regen через `eosio-abi2ts` из новой `marketplace.abi.json` после `coopcontracts` build, либо ручное добавление 18 canonical actions + canonical tables + canonical interfaces.
- **Эпик 3 «Витрина»** — IN REVIEW. PR #382 (`feat/E3-vitrina`) OPEN MERGEABLE. 6 коммитов (Stories 3.1–3.5 + BC-sync seam), 67 unit-тестов. Stories 3.4 (CAS counters) — callback-target для Эпика 4 + scaffolding `marketplace-order-sync.service.ts` (skeleton, throw NOT_IMPLEMENTED).
- **Эпики 4-10** — BACKLOG. Issues 598-7 … 598-13 разложены; story-requirements в `598-N-…-requirements/`.

**Открытые фоллоуапы Эпика 1:**
- L3 mutation `marketplaceSignOnboardingOffer` (write-mutation pool + `sndagreement`).
- Source-маркер `'registration_flow'` vs `'extension_gate'` в DTO.
- `marketplaceAcceptCpp` валидация повестки совета — после Эпика 8 (FR40).
- Финальный юридический текст оферты — `todo-tspp-templates.md` (блокирует Stories 1.7/1.9/1.11 в продовой подаче).
- Story 1.5 интеграционный тест против тестовой ноды ЦК — после Эпика 11.

**Реальное состояние brownfield (на marketplace2 @ d98041d):**

| Слой | Готово (membership) | Donor-клиринг (нужно решить судьбу) |
|---|---|---|
| ledger2 C++/TS реестры | 12 операций `o.mkt.*`, счета 10/91, кошельки `w.mkt.member`/`w.mkt.payout`/`w.wal.member`, WalletOp `REVOKE` | — (legacy `o.mkt.supply/recv` удалены) |
| YAML-стандарты `p.mkt.{supply,return,wroff}` | canonical имена actions | — |
| C++ actions (`marketplace.hpp` + 30 .cpp) | **ничего** из canonical | `orderoffer/accept/authcontrib/authreturn/supply/...` ~1660 LOC; legacy Wallet, не ledger2 |
| process-registry в controller | заглушки под membership (`p.mkt.reqst` убран) | — |
| cooptypes/contracts/marketplace TS-actions | нет canonical | 24 клиринговых обёртки |
| controller/application + domain/marketplace | нет canonical | 23 DTO + interactor + resolver + 6 interfaces |
| controller/extensions/marketplace | — | для категорий Ozon (clean arch, 7 TypeORM entities); может пригодиться для каталога Offer'ов |
| controller/extensions/marketplace-cards | — | минимальный каркас карточек |
| desktop/pages/Marketplace | нет canonical | 11 страниц под клиринг; `desktop/extensions/market` пуст |

**Решение 2026-05-12:** стратегии миграции не делаем — donor уже не работает по старой модели; собираем новую membership-модель в существующем контуре, donor-код переписывается / удаляется напрямую без переходников.

В `/bmad-create-architecture` MVP **не вводить adapter-слой и не описывать миграционные пути**. Прямо фиксировать: какие C++ actions/DTO/Vue-страницы из donor-листа удаляются, какие переписываются под canonical (`signsupp/signchair/signiss1/signiss2/acceptbatch/declinebatch/expirecycle/prepship/createorder(новая сигнатура)/cancelorder`), какие сохраняются (shipment/coopstock — если попадают в MVP scope, отдельно проверить).

**Обязательная enforcement-база для backend** — `mono-ai-4/components/controller/CLAUDE.md` (Composite-Entity `db/bc/derived`, Write-mutation pool с placeholder/sync_key dedup, ParserClient + Redis Streams, ForkRegistry, ADR-002/008/009/011/012; параметры через `config/blockchain.config.ts`, не magic numbers).
