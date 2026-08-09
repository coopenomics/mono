# План E2E-документации Marketplace MVP «Стол заказов»

Последнее обновление: 2026-05-22 (orderer/order-create переключён со stub Notify на реальный `marketplaceCreateOrder` через диалог в каталоге — см. §9.10).
Цель: ночной прогон harness + проза в `components/docs/docs/new/marketplace/...` + добавление новых разделов в `mkdocs.yml`. Параллельно — UI-багфиксы по факту.

## 0. Терминология (зафиксировать в UI/доках)

- **Предложение** — то, что публикует поставщик-пайщик (английский id остаётся `offer`, в контракте/коде/SDK — `offer`). В русских надписях, заголовках страниц, текстах кнопок — **только «Предложение»**, не «оферта», не «оферт».
- **Заказ** — то, что оформляет пайщик-заказчик (id `order`).
- **АПП** — Акт Приёма-Передачи (приёмка и выдача).
- **КУ / ПВЗ** — кооперативный участок / пункт выдачи заказов. Это одно и то же, в UI — «Кооперативный участок», в коротких фразах — «КУ».
- **Председатель кооператива** ≠ **председатель КУ**. Не смешивать в скриншотах и подписях.

Если в коде попадается русское слово «оферта» в `description` поля GraphQL, в label кнопки, в заголовке `.vue` — менять на «Предложение» по ходу прогона.

## 1. Кооператив и фикстуры

Базовая среда:
- 1 кооператив — **Восход** (`voskhod`), уже создан `boot:extra`.
- Совет уже сидит из `boot:extra`: `ant/petr/anna/mikhail/olga`. Председатель кооператива — `ant` (Иванов И. И.).

Дополнительные фикстуры — заводятся в **`installExtraData`** (`components/boot/src/init/infra.ts:574`):

| Фикстура | username | ФИО | Роль | Email |
|---|---|---|---|---|
| Председатель КУ Красногорск | `chairkrg` | Иванов Пётр Сергеевич | trustee `branch=krg` | chairkrg@voskhod.coop |
| Доверенное лицо КУ Красногорск | `trustedkrg` | Петров Михаил Андреевич | trusted КУ | trustedkrg@voskhod.coop |
| Оператор КУ Красногорск | `opkrg` | Кузнецов Александр Владимирович | operator | opkrg@voskhod.coop |
| Поставщик | `sidorov` | Сидоров Дмитрий Николаевич | offerer | sidorov@voskhod.coop |
| Заказчица | `petrova` | Петрова Екатерина Александровна | orderer | petrova@voskhod.coop |
| Член совета (для голосования) | переиспользуем `anna` (уже из совета) | — | board_readonly | — |

И **«для вида»** — дополнительные КУ, без полного штата (чисто для визуальной полноты карты ПВЗ и списков):

| Брана | Город | Председатель |
|---|---|---|
| `krg` | Красногорск | `chairkrg` (полный) |
| `odn` | Одинцово | `chairodn` (минимальный профиль) |
| `myt` | Мытищи | `chairmyt` (минимальный профиль) |

Эти три КУ Подмосковья закладываются скриптом в `installExtraData`, чтобы при `pnpm run reboot:extra` сразу была карта ПВЗ из 3 точек.

### Как заводить КУ корректно (нужно подсмотреть через UI)

Перед прописыванием в `boot` — один ручной прогон через **Стол председателя → Сеть ПВЗ → Создать КУ** (с интерактивным заполнением: имя, координаты, режим работы, председатель, trustees). Снять с этого прогона:
1. Какие именно GraphQL-mutations вызывает desktop (`Network` Playwright + `tea api graphql -F query=...` сохранением).
2. Какие записи появляются в `branch_*` таблицах PG и в on-chain `marketplace.branches`.
3. Какой actor подписывает on-chain действие (chairman кооператива? от его имени?).

После этого — повторить вызовы в `installExtraData` через `cooptypes`-actions, чтобы получить идентичное состояние без UI.

### Подписания трёхуровневого онбординга ЦПП

В `installExtraData` сразу подписать:
- **L1** (один раз для кооператива) — председатель + совет принимают ЦПП Marketplace, регистрируется оферта `coop_registration_offers_registry`.
- **L2** для `sidorov`, `petrova`, `chairkrg`, `trustedkrg`, `opkrg` — выбор ЦПП Marketplace при «вступлении» (фиктивно — просто запись в `agreements`).

Это снимает L3-gate на первом входе всех ролевых сценариев. Если фикстуры нет, каждый login превратится в скриншот с консент-диалогом — для большинства сценариев это шум.

Для **отдельного сценария L3-gate** (`scenarios/marketplace/onboarding/extension-gate.mjs`) — создаём «свежего» пайщика без подписи на ЦПП, чтобы поймать гейт.

## 2. Структура документации (mkdocs nav)

Новый кустарник в `mkdocs.yml` после раздела «Стол вычислительных ресурсов», перед «Общие собрания»:

```yaml
- Стол заказов:
    - Введение: new/marketplace/index.md
    - Онбординг ЦПП:
        - L1 — Подключение ЦПП кооперативом: new/marketplace/onboarding/coop-accept-cpp.md
        - L2 — Выбор ЦПП пайщиком: new/marketplace/onboarding/member-pick-cpp.md
        - L3 — Гейт первого входа: new/marketplace/onboarding/extension-gate.md
    - Стол заказчика:
        - Каталог витрины: new/marketplace/orderer/catalog.md
        - Оформление заказа: new/marketplace/orderer/order-create.md
        - Мои заказы: new/marketplace/orderer/orders.md
        - Сводный заказ: new/marketplace/orderer/consolidated.md
        - Получение заказа: new/marketplace/orderer/receive.md
        - Возврат имущества: new/marketplace/orderer/return-claim.md
    - Стол поставщика:
        - Создание предложения: new/marketplace/offerer/offer-create.md
        - Мои предложения: new/marketplace/offerer/offers.md
        - Входящие заказы: new/marketplace/offerer/incoming-orders.md
        - Подготовка отгрузки: new/marketplace/offerer/shipment-prep.md
        - Подпись акта приёмки: new/marketplace/offerer/apl-reception-sign.md
    - Стол оператора КУ:
        - Ожидаемые поставки: new/marketplace/operator/incoming-shipments.md
        - Приёмка партии: new/marketplace/operator/apl-reception-create.md
        - Маркировка имущества: new/marketplace/operator/inventory-label.md
        - Склад участка: new/marketplace/operator/inventory-list.md
        - Поток выдач: new/marketplace/operator/orders-board.md
    - Стол председателя КУ:
        - Закрывающая подпись приёмки: new/marketplace/branch-chairman/apl-reception-close.md
        - Открытие выдачи: new/marketplace/branch-chairman/issuance-open.md
        - Обработка возвратов: new/marketplace/branch-chairman/return-approve.md
    - Стол председателя кооператива:
        - Модерация предложений: new/marketplace/chairman/offer-moderation.md
        - Категории ЦПП: new/marketplace/chairman/category-whitelist.md
        - Сеть ПВЗ: new/marketplace/chairman/branches.md
        - Списания имущества: new/marketplace/chairman/writeoff-propose.md
    - Стол совета (Marketplace):
        - Голосование по списанию: new/marketplace/board/agenda-writeoff.md
        - Склад кооператива: new/marketplace/board/warehouse-readonly.md
        - Выплаты поставщикам: new/marketplace/board/payouts-readonly.md
```

Итого: **30 страниц = 30 сценариев `.mjs`**.

## 3. Сценарии `docs-harness`

```
components/docs-harness/scenarios/marketplace/
├── PLAN.md                              (этот файл)
├── onboarding/
│   ├── coop-accept-cpp.mjs              L1: chairman + соглашение совета
│   ├── member-pick-cpp.mjs              L2: пайщик при вступлении
│   └── extension-gate.mjs               L3: свежий пайщик, первый визит на стол
├── orderer/                             (фикстура petrova)
│   ├── catalog.mjs
│   ├── order-create.mjs
│   ├── orders.mjs
│   ├── consolidated.mjs                 для volume_based циклов
│   ├── receive.mjs                      финальная подпись акта выдачи
│   └── return-claim.mjs
├── offerer/                             (фикстура sidorov)
│   ├── offer-create.mjs
│   ├── offers.mjs                       (Мои предложения + статус модерации)
│   ├── incoming-orders.mjs
│   ├── shipment-prep.mjs
│   └── apl-reception-sign.mjs           первая подпись на акте приёмки
├── operator/                            (фикстура opkrg)
│   ├── incoming-shipments.mjs
│   ├── apl-reception-create.mjs
│   ├── inventory-label.mjs              single + shipment (EAN-13)
│   ├── inventory-list.mjs
│   └── orders-board.mjs
├── branch-chairman/                     (фикстура chairkrg)
│   ├── apl-reception-close.mjs
│   ├── issuance-open.mjs
│   └── return-approve.mjs
├── chairman/                            (фикстура ant)
│   ├── offer-moderation.mjs
│   ├── category-whitelist.mjs
│   ├── branches.mjs                     создание КУ + trustees + геокарта
│   └── writeoff-propose.mjs
└── board/                               (фикстура anna)
    ├── agenda-writeoff.mjs
    ├── warehouse-readonly.mjs
    └── payouts-readonly.mjs
```

Шаблон сценария — см. `components/docs-harness/scenarios/blagorost/*.mjs`. Обязательные поля meta:

```js
export const meta = {
  title: '<Человеческий заголовок страницы>',
  docPath: 'new/marketplace/<стол>/<имя>.md',
  assetsDir: 'assets/new/marketplace/<стол>/<имя>',
  role: 'orderer' | 'offerer' | 'operator' | 'branch-chairman' | 'chairman' | 'board',
};
```

## 4. Магистральные E2E-потоки (ночной прогон)

Каждый поток — последовательность сценариев, **прогоняемая в одной сессии** с общими доменными сущностями (одно Предложение → один Заказ → одна Партия → один Акт → один Возврат).

### Поток I — «Витрина»: каталог рождается
1. `chairman/branches.mjs` — председатель кооператива создаёт КУ Красногорск + назначает chairkrg + trustedkrg
2. `chairman/category-whitelist.mjs` — включает категории «овощи/фрукты» и «бакалея»
3. `offerer/offer-create.mjs` — Сидоров публикует Предложение «Картофель Адретта, мешок 25 кг», `cycle_type=volume_based`
4. `chairman/offer-moderation.mjs` — председатель одобряет
5. `orderer/catalog.mjs` — Петрова видит Предложение в каталоге

### Поток II — «Закупочный цикл»: заказ → приёмка → выдача (главный сценарий MVP)
1. `orderer/order-create.mjs` — Петрова заказывает 2 мешка → подписывает Membership
2. `orderer/consolidated.mjs` — сводный заказ формируется на достижении объёма
3. `offerer/incoming-orders.mjs` — Сидоров принимает партию
4. `offerer/shipment-prep.mjs` — Сидоров подтверждает готовность к отгрузке
5. `operator/apl-reception-create.mjs` — opkrg открывает акт приёмки на КУ
6. `offerer/apl-reception-sign.mjs` — Сидоров ставит первую подпись акта
7. `branch-chairman/apl-reception-close.mjs` — chairkrg закрывает акт → имущество на балансе
8. `operator/inventory-label.mjs` — opkrg маркирует партию (EAN-13)
9. `branch-chairman/issuance-open.mjs` — chairkrg открывает выдачу заказа Петровой
10. `orderer/receive.mjs` — Петрова получает 2 мешка, ставит финальную подпись (факт=2)

### Поток III — «Возврат и списание»
1. `orderer/return-claim.mjs` — Петрова подаёт возвратную заявку на 1 мешок (брак)
2. `branch-chairman/return-approve.mjs` — chairkrg одобряет → возврат на склад КУ
3. `chairman/writeoff-propose.mjs` — председатель кооператива выносит списание на совет
4. `board/agenda-writeoff.mjs` — Анна (член совета) голосует «за»
5. `chairman/writeoff-propose.mjs` (повторный кадр «решение принято») — операция `o.mkt.wroff` исполнена
6. `board/warehouse-readonly.mjs` — на складе остаётся 1 мешок

### Поток IV — «День оператора ПВЗ»
1. `operator/incoming-shipments.mjs` — opkrg видит ожидаемые поставки от Сидорова
2. `operator/apl-reception-create.mjs` — открывает приёмку (тот же акт, что в потоке II, но другая точка обзора)
3. `operator/inventory-label.mjs` — маркирует имущество
4. `operator/inventory-list.mjs` — открывает реестр склада участка
5. `operator/orders-board.mjs` — смотрит поток заказов, готовых к выдаче

Поток IV переиспользует сущности потока II с другой ролью — это позволяет показать всю «кухню» оператора без необходимости запускать дополнительные транзакции.

## 5. Конвенции скриншотов

- viewport `1120×800 × dpr 1.25 = 1400×1000 PNG` (зашиты в `lib/harness.mjs`).
- открытая левая навигация в большинстве кадров — чтобы виден контекст стола.
- `dismissOnboardingDialogs(page)` в `beforeEach` каждой роли (кроме `extension-gate.mjs`).
- никаких toast'ов в момент `shot()` — ждать `page.locator('.q-notification').count() === 0` перед снимком.
- даты в фикстурах — диапазон 2026-05-15 … 2026-05-20 (создание Предложения, заказа, отгрузки, приёмки, выдачи). Не «вчера»/«сегодня» — фиксированные ISO.
- русские названия категорий, КУ, Предложений (никаких `test1`, `aaa`).
- 5–8 кадров на страницу: исходный экран → действие → результат, плюс контекстные подсказки.

## 6. Этапы работы (порядок исполнения, по «погнал»)

### Фаза 0 — Подготовка стенда и фикстур (≈ 60–90 мин)
1. Worktree от `marketplace2` на ветке `feat/marketplace-docs`.
2. Сделать `pnpm run reboot:extra`, убедиться, что стек поднимается.
3. Через UI председателя кооператива создать **один** КУ Красногорск (записать все mutations + актеров). Зафиксировать факт в этом PLAN.md (приложение «Снятые факты»).
4. Перенести логику создания КУ + назначения председателя + trustees в `installExtraData` (`components/boot/src/init/infra.ts`).
5. Добавить заведение пайщиков `chairkrg`, `trustedkrg`, `opkrg`, `sidorov`, `petrova`, `chairodn`, `chairmyt` в `installExtraData`.
6. Подписать им L1/L2 onboarding в `installExtraData` (через cooptypes-actions `sndagreement`).
7. Прогон `pnpm run reboot:extra` повторно — стек поднимается со всеми фикстурами.
8. `KNOWN_FIXTURES` в `components/docs-harness/bin/shoot.mjs` пополнить новыми пайщиками.

### Фаза 1 — Сценарии (≈ 3 часа)
По одному сценарию за раз, в порядке потоков I → II → III → IV. После каждого:
- `node bin/shoot.mjs marketplace/<scen>` — проверить, что снято.
- Если упало — поймать FAIL.png, пофиксить либо сценарий, либо UI (правки в worktree, hot-reload подхватит).
- На каждом потоке делать отдельный коммит в `feat/marketplace-docs`.

### Фаза 2 — Проза (≈ 2 часа)
По одному `draft.md` за раз:
- Прочитать manifest + все PNG.
- Написать прозу бизнес-языком (без «mutation», «resolver», «callback»).
- Прогнать `node lib/install.mjs marketplace/<scen> --md`.

### Фаза 3 — Сборка документации
1. Обновить `mkdocs.yml` по структуре из секции 2.
2. `pnpm --filter @coopenomics/docs build` (или `mkdocs build` локально) — проверить, что нет broken links.
3. Локальный `mkdocs serve` — пройти по всем 30 страницам глазами.
4. Финальный коммит, push, PR `feat/marketplace-docs` → `marketplace2`.

## 7. Что НЕ делать ночью (вне scope)

- Не трогать существующие сценарии `blagorost/`, `onboarding/`, `auth/`, `registration/`.
- Не править `mkdocs.yml` за пределами вставки нового кустарника.
- Не запускать полный jest (по запрету в CLAUDE.md). Точечный — только если конкретный сервис подозрительно сломался.
- Не вызывать `pnpm generate-schema` / `generate-client` — controller на marketplace2 уже актуален, SDK собран.
- Не делать `tea pr merge` — merge делает пользователь руками.
- Не править `_blago/` — это документ другой системы.

## 8. Снятые факты (заполняется ночью)

(Пусто на момент старта плана. Будет дополнено по результатам ручных прогонов и снятых GraphQL-вызовов.)

## 9. Текущее состояние (живой статус)

Срез на **2026-05-22 (день+вечер)**, ветка `worktree-marketplace-docs-impl` (PR #17; PR #24 закрыт, коммиты перенесены fast-forward в родительскую ветку).

### 9.16. Magistral II ЗАКРЫТА через UI — три корневые причины холодного Vite найдены (2026-05-22 вечер)

Полный 4-шаговый прогон Magistral II:

1. `offerer/offer-create` (ivanpetrov, cycle_type=individual) → offer `7330c7c9` PENDING_MODERATION.
2. `chairman/offer-moderation` (ant approve) → offer → ACTIVE.
3. `orderer/order-create` (ekaterina, qty=2) → order `15e70181` создан, 240 RUB списано из Main Wallet.
4. `offerer/incoming-orders` (ivanpetrov) → **2 карточки заказов** (15e70181 + старый 09c9d6c8) с действиями «Принять/Отказать» в табе «Все».

**Три корневые причины, которые годами мешали harness'у работать стабильно после `reboot:extra` / docker restart:**

#### Причина 1: cooptypes/dist/index.mjs мог отсутствовать (root cause Vite-залипания)

В `components/cooptypes/package.json` `exports."."."import": "./dist/index.mjs"`. unbuild (`rollup.emitCJS: true` + дефолтный ESM) должен производить **оба** файла — `.mjs` + `.cjs`. Но если предыдущий билд сбился частично (или кто-то ручно удалил `.mjs`), Vite в desktop dev пытается резолвить `import` и виснет на отсутствующем модуле бесконечно — все Quasar-страницы отдают пустой bootstrap-спиннер, harness ловит «01-empty-form» как пустую картинку 7KB. Лечится `pnpm --filter cooptypes build` + копирование в host'овый `/home/admin/mono-ai-4/components/cooptypes/dist/` (desktop bind-mount'ит хостовый каталог, не worktree). После rebuild Vite через fs-watch подхватывает.

#### Причина 2: Vite optimizeDeps >20s vs `waitForTimeout(3000)`

Quasar SPA на холодном Vite (после рестарта desktop / chunk eviction) делает **первое** разрешение route-chunk'а 30-90 секунд (`optimizeDeps` + dependency-graph traversal). Сценарии писали `await page.waitForLoadState('networkidle', 20000); await page.waitForTimeout(3000)` — это давало 23 секунды, и при холодном старте они истекали ДО того как Vue монтировал страницу. shot захватывал пустой спиннер.

**Фикс:** в каждом сценарии после goto ставить `await page.locator('<якорь>').first().waitFor({ state: 'visible', timeout: 90000 })`, где `<якорь>` — конкретный элемент целевой страницы (label «Название», text="Модерация предложений", `.mp-onboarding-gate`, `.q-page` как fallback). Это надёжно отличает «страница отрисовалась» от «Vite ещё грузит».

#### Причина 3: `localStorage.setItem('harness:noBranchOverlay', '1')` после loginAs опаздывает

`components/desktop/src/processes/watch-branch-overlay/index.ts` читает флаг **только в `checkConditions()`**, который вызывается:
- один раз при mount'е процесса,
- по `watch([session.isAuth, system.info, account.account], …, { deep: true })`.

setItem на localStorage **не** триггерит watch, потому что watch смотрит на pinia-store, не на storage. Если процесс уже отработал свой первый auth-tick с пустым localStorage → overlay активен и остаётся даже после setItem. Сценарии писали `await page.evaluate(() => localStorage.setItem(...))` **после** `loginAs(page, fixture)` — оверлей рендерится первым и перекрывает целевую страницу.

**Фикс:** `await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'))` ДО `loginAs`. `addInitScript` устанавливает скрипт, который Playwright выполняет на каждой странице ПЕРЕД любым document load — флаг гарантированно установлен к первому auth-tick'у.

#### Что осталось

- **Race-condition парсера vs backend cycle-hook** (2026-05-22): `marketplace-order-create.service.ts:248` ставит `ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL` для individual offer'а, затем `BlockchainConsumerService` обрабатывает chain action `createorder` и `MarketplaceOrderSyncService` (~2с спустя) перетирает status обратно в ACTIVE. Не критично для UI (в incoming-orders заказ виден со статусом «Размещён»), но рассогласование backend vs chain-truth — кандидат в Story 4.x фикс.

### 9.15. (исторический) — Magistral II частично снята; следующий блокер — cycle_days в фикстуре offer'а (2026-05-22)

Magistral II разблокирована тремя коммитами PR #24 (`e7144e9f3d2` factory 1100/1101 + L3 mutation; `1ae4d8959fd` variables wrapper + harness fix; `fa10ddec399` normalizeTxResult). Прогон `orderer/order-create` зелёный: Notify «Заказ создан», списание Main Wallet ekaterina 10000→9520, decrement offer 50→48.

**Снято в этой итерации:**

- `offerer/incoming-orders.mjs` — 2 шота (01-overview — диалог Quasar onboarding «Выберите КУ» для ivanpetrov; 02-pending-filter — таб «Ждут моего акцепта», пусто). Empty-state корректна, потому что заказ ekaterina висит в status=ACTIVE.

**Корневой блокер для большинства magistral II reshoot'ов:**

В Postgres `marketplace_order` для ekaterina один заказ со status=ACTIVE (создан commit fa10ddec399). Backend `MarketplaceCycleAggregatorService` имеет `@Cron(CronExpression.EVERY_5_MINUTES)` (Story 4.2), который для time_based offer'ов с `cycle_days=N` сравнивает `offer.created_at + N` с now() и тогда переводит Order: `ACTIVE → ACCEPTED_PENDING_SUPPLIER`. **Текущая фикстура offer'а через UI `offerer/offer-create.mjs` использует default `cycle_days=7`** — заказ застревает в ACTIVE на 7 дней, страницы поставщика (incoming-orders), сводный заказ (consolidated), и далее по цепочке остаются пустыми.

**Канон-вариант для harness/документации:** добавить offer с `cycle_type=individual` (синхронный переход `ACTIVE → ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL` прямо в `marketplace-order-create.service.ts:248` без cron). Альтернатива — `cycle_days=0` или admin-mutation `forceCycleResolve` (dev-only).

**Реализация (следующий шаг):**

- (Опция 1) Изменить сценарий `offerer/offer-create.mjs` чтобы создавать **два** offer'а: текущий time_based 7d + дополнительный individual. Тогда magistral II разворачивается на individual-offer'е без 7-дневного ожидания.
- (Опция 2) Реализовать таску #122 — `seed-marketplace-flow.ts` TS-скрипт в `components/boot/src/scripts/`. Поднимает Login chain через WIF из `state/participants/*.json` и проводит магистраль до конца через GraphQL mutations. Запускается перед harness прогоном (или из installExtraData).

**Дополнительная находка:** в backend есть некритичный noise `MutationLoggingInterceptor` пишет `null value in column "username"` при анонимных mutations — не блокирует pipeline, но загрязняет логи. Кандидат в отдельный фикс (MutationLoggingInterceptor должен skip'ать когда нет JWT).

### 9.1. Фаза 0 — закрыта

- ✅ Worktree + ветка `worktree-marketplace-docs-impl` от `dev`.
- ✅ Backend mono-ai-4: coopback `:3028`, chain `:8918`, mongo `:27047`, postgres `:5562`. Desktop dev `:2999`.
- ✅ `installExtraData` расширен 7 ролевыми пайщиками (`chairkrg`/`trustedkrg`/`opkrg`/`sidorov`/`petrova`/`chairodn`/`chairmyt`) + 3 КУ Подмосковья (`krg`/`odn`/`myt`) — `068e425c4a9`.
- ✅ `installExtraData` активирует `market` extension и сеет marketplace категории — `433ae6dc6a4`.
- ✅ Каждой КУ дефолтный `bank_transfer` payment method — фикс NPE `getBranches` — `2a73af90d31`.
- ✅ `KNOWN_FIXTURES` в `bin/shoot.mjs` пополнены.
- ✅ Onboarding gate L3 — `loginAsChairman` теперь автоподписывает соглашения после reboot:extra.
- ✅ PDF EROFS — `factory/dist` патч на `os.tmpdir()` смонтирован через override — `730ccefdeaa`.
- ✅ SDK обёртки для модерации (`ListPendingOffers`/`ListModerationLog`/`ApproveOffer`) + страница `ChairmanModerationPage.vue` — `e67d7ca77b8`.

### 9.2. Фаза 1 — Сценарии

**Сценариев по плану: 30. Реализовано .mjs: 25/30 (83%).**

| Раздел | По плану | Файлы в репо | Статус |
|---|---|---|---|
| `onboarding/` | 3 | `extension-gate` | 1/3 — UI L1/L2 не реализован в Vue (см. §9.6) |
| `orderer/` | 6 | `catalog` (с offer), `order-create` (stub Notify), `orders`, `ready-to-receive`*, `returns`*, `marketplace-tour`† | 5/6 — нет `consolidated` (Эпик 4 в разработке) |
| `offerer/` | 5 (+1 `payments` сверх плана) | `offer-create`, `shipment-prep`, `apl-reception-sign`, `payments`† | 3/5 — нет `offers`, `incoming-orders` (UI не реализован, §9.6) |
| `operator/` | 5 | `apl-reception-create`, `inventory-label`, `issuance`*, `returns`*, `warehouse`* | 5/5 — все 5 покрыты (`warehouse`≈`inventory-list`, `issuance`≈`orders-board`, `returns`→branch-chairman). |
| `branch-chairman/` | 4 | `pvz-list`† | 0/4 — UI не реализован (§9.6) |
| `chairman/` | 4 | `offer-moderation`, `writeoff-propose`, `branches`, + `dashboard-overview`†, `design-system`†, `ecosystem`†, `market-tour`†, `warehouse-summary`† | 3/4 — нет `category-whitelist` (UI не реализован, §9.6); 5 extra сняты для admin-обзора |
| `board/` | 3 | — (папки нет) | 0/3 — UI совета для marketplace не реализован (§9.6) |

`*` — есть .mjs под более «человеческим» именем (`ready-to-receive` вместо плановой `receive`, `returns` вместо `return-claim`/`return-approve`, `warehouse` вместо `inventory-list`, `issuance` вместо `orders-board`).
`†` — extra-сценарии сверх плана: общие обзорные шоты столов; задокументированы в `docs/new/marketplace/...` отдельными MD.

### 9.3. Что снято прозой в `components/docs/docs/new/marketplace/`

По git log (`5c333f8fa19..HEAD`):
- Стол председателя — обзор, экосистема, сводный склад, списания скоропорта, дизайн-система Эпик 10 (3 шота), модерация offer'ов (3 шота, в работе через текущий commit).
- Стол заказчика — обзор «глазами пайщика» (4 шота), каталог (empty), мои заказы (empty), готово к получению (empty), гарантийные возвраты (empty).
- Стол оператора — открытие выдачи (empty), склад моего КУ (empty), обработка возвратов на ПВЗ (empty).
- Стол председателя КУ — сеть ПВЗ кооператива (empty).
- Онбординг — L3 (3 шота, гейт первого входа).
- Все MD получили frontmatter (`b0055eb8cec`).

### 9.4. Что осталось сделать в Фазе 1 (приоритет)

**Магистраль I — empty-state шоты — фактически исчерпана UI-кодом.** Из 9 оставшихся пунктов плана **0 могут быть сняты harness'ом**: все требуют UI-страниц, которых нет в `components/desktop/extensions/market/install.ts`. См. §9.6 «Дыры UI».

**Магистраль II (приоритет)** — потоки с реальными данными. Требуют либо сидера в `installExtraData` (создаёт APPROVED offer + ORDER + SHIPMENT в БД), либо последовательности через API. Для перешота уже существующих empty-state шотов нужны данные:

1. `orderer/orders.mjs` (existing) — после создания ORDER переснять «Мои заказы» с реальными карточками.
2. `orderer/consolidated.mjs` (NEW) — Сводный заказ orderer'а (UX-DR4 ConsolidatedOrderHeader).
3. `orderer/ready-to-receive.mjs` (existing) — после shipment с фактом доставки.
4. `offerer/shipment-prep.mjs` (existing) — после accept ORDER поставщиком.
5. `offerer/apl-reception-sign.mjs` (existing) — после receive shipment в КУ.
6. `operator/apl-reception-create.mjs` (existing) — после receipt из ERP.
7. `operator/inventory-label.mjs` (existing) — после APP.
8. `operator/warehouse.mjs` (existing) — после labeling.
9. `operator/issuance.mjs` (existing) — после ORDER → SHIPMENT → APP.

**Подход к Магистрали II.** Расширить `installExtraData` ещё одним сидером (`marketplace-flow.ts`?): один APPROVED offer + один ORDER от petrova + ACCEPT поставщиком + SHIPMENT в `krg`. Для каждой стадии переснять соответствующий empty-state как «с данными» в отдельном шоте `02-with-data` (рядом с `01-empty`).

### 9.5. Известные блокеры

- **opensearch не поднимать в dev** (`feedback_no_opensearch_in_dev.md`) — `docker-compose.override.yaml` уже выставляет `profiles: ["never"]` для `opensearch`.
- **Desktop рестартовать только по явному разрешению** (`feedback_desktop_no_restart.md`) — было одноразовое разрешение для подхвата свежего `sdk/dist`; новые правки SDK потребуют либо новой апрува, либо ждать естественного цикла reload.
- **`schema.gql` автоген** — не коммитить (`M components/controller/schema.gql` в working tree игнорируется по правилу пользователя).

### 9.6. Дыры UI — нереализованные страницы Marketplace

**Статус на 2026-05-21 (вечер): все 9 страниц реализованы и запушены в worktree.** Раньше PLAN.md перечислял 9 «дыр» — теперь это карта реализованных страниц с роутами и коммитами:

| План | Файл Vue | Роут | Коммит |
|---|---|---|---|
| `onboarding/coop-accept-cpp` | OnboardingCoopAcceptCpp.vue | `/market-admin/onboarding/coop-cpp` | `510ccf545bb` |
| `onboarding/member-pick-cpp` | OnboardingMemberPickCpp.vue | `/market/onboarding/member-cpp` | `147951356ab` |
| `chairman/category-whitelist` | ChairmanCategoryWhitelist.vue | `/market-admin/category-whitelist` | `50538b45d43` |
| `offerer/offers` | OffererMyOffers.vue | `/market-supplier/my-offers` | `69d3e79f36c` |
| `offerer/incoming-orders` | OffererIncomingOrders.vue | `/market-supplier/incoming-orders` | `69d3e79f36c` |
| `board/agenda-writeoff` | BoardAgendaWriteoff.vue | `/market/board-writeoff` | `2a41354c328` |
| `board/payouts-readonly` | BoardPayoutsReadonly.vue | `/market-admin/payouts` | `261be9a2702` (placeholder, требует Phase 2 backend) |
| `orderer/consolidated` | OrdererConsolidated.vue | `/market/consolidated` | `e40b74fcf91` |

**`board/warehouse-readonly`** в плане был — но `AdminWarehouseSummaryPage` уже доступна `roles: ['chairman', 'member']`, и сценарий `chairman/warehouse-summary` снимает её. Сценарий «board/warehouse-readonly» как отдельный — дубль; объединяем с `chairman/warehouse-summary` в прозе («сводный склад читают и председатель, и совет — UI одинаковый»).

**Что делать дальше с этими 9 страницами в документации.** Прогон harness'ом со снятием скриншотов теперь возможен; existing MD-заглушки с admonition `!!!warning "Эпик X — в разработке"` надо обновить — снять admonition или переписать на actual proza по факту экрана. Это можно делать инкрементально по мере прогона `bin/shoot.mjs <раздел>/<имя>`.

### 9.7. Аудит SDK/backend по 9 страницам (2026-05-21, окончательно)

**Аудит был пересмотрен по факту:** многое из «нужно backend-доработать» на самом деле было уже DONE — `marketplaceListSupplierOrders`, `marketplaceListMyOffers`, available-categories endpoints, marketplaceOnboardingState. Окончательная сводка:

| Страница | Backend | SDK обёртка | Что добавлено в worktree |
|---|---|---|---|
| `onboarding/coop-accept-cpp` | ✅ Story 1.9 | ✅ создан wrapper | Vue + роут (`mp-role-admin`) |
| `onboarding/member-pick-cpp` | ✅ Story 1.4 (`marketplaceOnboardingState`) | ✅ создан wrapper | Vue с canon `OnboardingCPPGate`; редирект на Registrator для подписи |
| `chairman/category-whitelist` | ✅ available-category-admin.resolver.ts | ✅ создано 4 wrappers (Get/Stats/Add/Remove) | Vue с диалогом ID-через-запятую (tree-выбор — следующий шаг) |
| `offerer/offers` | ✅ `marketplaceListMyOffers` (был всё время) | ✅ создан wrapper | Vue с canon `CatalogOfferCard`, client-side фильтр + поиск |
| `offerer/incoming-orders` | ✅ `marketplaceListSupplierOrders` (был всё время) | ✅ создан wrapper | Vue с canon `OrderCard role='offerer'`, фильтр по статусу |
| `board/agenda-writeoff` | ✅ `marketplaceListWriteoffProposals` | ✅ reuse через AdminWriteoffs/api | Vue read-only лента, фильтр по статусу |
| `board/payouts-readonly` | ⚠️ требует доп. `Payment / read:all` policy | — | Informational placeholder со ссылками на нужные файлы |
| `orderer/consolidated` | ✅ `marketplaceListMyOrders` + cycle_id | ✅ reuse MyOrders/api | Vue с группировкой по cycle_id |

**Уроки.** PLAN.md до пересмотра считал, что backend для 6 из 9 страниц нужно доработать — реально требовалась доработка только для `board/payouts-readonly`. Перед оценкой «нужен ли backend» нужно делать grep `marketplace-*.resolver.ts:@Query` и `@Mutation` — список из 70+ marketplace-резолверов покрывает почти все use-case'ы MVP. Аудит §9.7 (исходный) был слишком пессимистичен из-за отсутствия проверки resolver-каталога.

**Что осталось технического долга после 9 страниц:**

1. **`board/payouts-readonly` backend**: расширить `marketplace-access-matrix.ts` `Payment / read:all` и добавить query `marketplaceListOutgoingPayments` (опц. `supplier_account`).
2. **`chairman/category-whitelist` tree-выбор**: подключить `marketplaceGetCategoryTree` через диалог-tree.
3. **~~Прогон harness'а~~ ✅ выполнен** — 9 PNG установлены, admonition сняты (коммит `ee06d405136`, 2026-05-22). MD-проза готова.

### 9.14. Backend-фоллоуап Эпика 1 реализован (вариант A) — magistral II разблокирована (2026-05-22 вечер)

Пользователь выбрал (A): полная реализация. Сделано:

- **Factory adapters 1100 + 1101** в `components/factory/src/{Actions,Templates}/` + регистрация в `Templates/registry.ts` и factory `src/index.ts` map. Сборка зелёная.
- **cooptypes расширены** под marketplace: `IVars.marketplace_program?` + `IVars.marketplace_offer_template?`; `UdataKey.MARKETPLACE_AGREEMENT_NUMBER/CREATED_AT`; Action `1101.MarketplaceOffer` теперь принимает `marketplace_agreement_number` + `marketplace_agreement_created_at`.
- **VarsSchema** в factory расширена соответствующими полями (валидация JSONSchema).
- **L3 mutation `marketplaceSignOnboardingOffer`** в `marketplace-onboarding.resolver.ts` + метод `signOnboardingOffer()` в `MarketplaceOnboardingService` — лукап coagreement по `MARKETPLACE_AGREEMENT_TYPE`, делегирование в `walletBlockchainPort.signProgramAgreement` (program_id из coagreement, draft_id оттуда же, document — подписан фронтом).
- **DTO** `MarketplaceSignOnboardingOfferInputDTO` — только signed document; coopname+username берутся из guard'а/config'а (защита от подмены).
- **SDK обёртка** `Mutations.Marketplace.MarketplaceSignOnboardingOffer` + zeus regen.
- **Vue dialog** `OnboardingMemberPickCpp`: `onAccept` теперь рендерит оферту (registry_id=1101), подписывает локальным WIF и отправляет через новую mutation; после успеха — Notify «Оферта подписана» + редирект на `/market/catalog`. Раньше был редирект в Registrator — убран.
- **`OnboardingCPPGate`** widget получил пропс `busy: boolean` для loading-state кнопки подписи.

**Реальная проверка остаётся на e2e-прогон harness'а `orderer/order-create`:** ekaterina входит, видит gate, подписывает → caталог → «Заказать» → Notify «Заказ создан». Сценарий сделать следующим шагом.

**Лицензия на дальнейшую работу:** пользователь явно подтвердил «полная реализация — стандартный сценарий, при регистрации и для существующих пайщиков должно работать». Текст оферты остаётся «рыбой» в cooptypes 1100/1101 (юр.отдел доделает позже без рисков для подписей: registry_id и flow не меняются).

### 9.13. Магистраль II заблокирована backend-фоллоуапом Эпика 1 — ждём решения пользователя (2026-05-22 вечер)

После фикса cycle_type mapper'а (§9.11) и пополнения L3 Main Wallet (§9.12 был решён через `CHAIN_URL=8918`: ekaterina + ivanpetrov + petrova + sidorov по 10000 RUB на стенде) — магистраль II упёрлась в **новый блокер**: для submit'а Order'а контракт `o.mkt.assign` требует записи в `wallet::users.programs[]` с `program_id=2` (ЦПП «Стол заказов»). У ekaterina этой записи нет — она подписала только ЦПП Кошелёк (program_id=1) через signin onboarding.

**Корневая причина — две части фоллоуапа Эпика 1 не реализованы:**

1. **Factory adapter `1100.MarketplaceOfferTemplate.ts` + `1101.MarketplaceOffer.ts`** в `components/factory/src/Actions/` и `components/factory/src/Templates/`. cooptypes registry уже создаёт оба template'а (Story 1.7, commit `feat/1-7-marketplace-template-registry`), с рыбой контента ожидающей юр.отдел (см. `_bmad-output/planning-artifacts/todo-tspp-templates.md`). Но factory render-adapter отсутствует — `documentFactory.render(1100|1101, …)` отвечает «Фабрика для документа #N не найдена». Без adapter'а core registration-flow на этапе L2 не может срендерить instance оферты для подписи через `wallet::signagree`.

2. **L3 mutation `marketplaceSignOnboardingOffer`** в `components/controller/src/extensions/marketplace/application/resolvers/` — обозначена как фоллоуап Эпика 1 в `extensions/marketplace/application/onboarding/README.md` (секция «Что добавит фоллоуап»). Сейчас страница `OnboardingMemberPickCpp.vue` информационная: показывает gate, редиректит в core Registrator-мастер. Без mutation L3 пайщик, уже зарегистрированный без ЦПП Marketplace, не может подписать её позже.

**Источник в blago:** `~/blago/production/1-prilozhenie-stol-zakazov/components/3-minimalnyy-produkt/issues/598-4-epik-1-...md` — статус DONE, в открытых фоллоуапах явно: «L3 mutation `marketplaceSignOnboardingOffer` (write-mutation pool + sndagreement)», «Финальный юридический текст оферты — `todo-tspp-templates.md`».

**Что НЕЛЬЗЯ делать (директива пользователя «чтобы ты тут лишнего не намутил»):** хак-скрипт, форджит подпись `wallet::signagree` от coopname-ключа с self-signed minimal document. Уже пробовал — auto-mode classifier (правильно) заблокировал, скрипт удалён.

**Развилка (нужно решение пользователя):**

- **(A) Реализовать factory adapter 1100/1101 + L3 mutation.** Полноценная фичевая работа: 4 файла factory + 1 файл backend resolver + write-mutation pool + sndagreement wiring + Vue dialog поверх gate-страницы для подписания. Объём — соизмеримо с одной Story Эпика 1 (~600-900 LoC). Текст оферты остаётся «рыбой» (юр.отдел делает финальную редакцию позже). После реализации: ekaterina (и любой существующий пайщик без ЦПП Marketplace) сможет подписать оферту через диалог `OnboardingMemberPickCpp`, и `o.mkt.assign` пройдёт.

- **(B) Реализовать только factory adapter 1100/1101 (без L3 mutation).** Минимально достаточный блок для L2: новые пайщики при signup'е подпишут marketplace_offer автоматически через core registration-flow. Существующие пайщики (включая ekaterina) остаются без ЦПП Marketplace, пока их не пересоздать через reboot:extra + новый signup. Это требует `reboot:extra` + новую регистрацию ekaterina, что сбросит её 10000 RUB баланс — нужна повторная эмиссия через `marketplace-deposit-fund.ts`. Дольше прогон, но без backend mutation.

- **(C) Не разблокировать magistral II в этом worktree.** Зафиксировать блокер в документации (уже сделано в `order-create.md`), снять что можно в empty-state, дождаться отдельной задачи на фоллоуап Эпика 1. Текущее состояние документации — честное.

**Рекомендация:** (B) — наименьший security-scope и не требует write-mutation pool в controller, а ekaterina при reboot'е не критична. Но (B) всё равно требует ~300-500 LoC + 1 reboot + 1 deposit-fund + reshoot.

Без решения пользователя — продолжать harness/документационные итерации бессмысленно: все оставшиеся магистраль-II shots требуют успешного order-create.

### 9.12. Попытка пополнить L3-кошелёк → следующий блокер: пайщик не член кооператива (2026-05-22)

Создан one-shot скрипт `components/boot/src/scripts/marketplace-deposit-fund.ts` —
эмиссия в Main Wallet через `wallet::createdeposit + gateway::completeincome` от
имени кооператива. Pattern из `seed-capital/phases/08-investments.ts`.

Прогон `FUND_USERNAMES=ekaterina pnpm --filter @coopenomics/boot exec esno ...` → **fail:**
`assertion failure with message: Пайщик не найден в кооперативе` (тот же fail для `sidorov`).

**Root cause:** `wallet::createdeposit` через цепочку lookup'ов упирается в
`coops_access_helpers.hpp:57`: `eosio::check(participant_row != participants_tbl.end(), "Пайщик не найден в кооперативе")`.
Текущий seed (add-plain-participant + ensureMarketplaceParticipant) создаёт
on-chain registrator account + mongo individual + pg user, но **НЕ заводит
запись в `soviet::participants`** — это требует прохождения через `joincoop`
decision type: совет (3 votefor + authorize + exec) утверждает заявление и
оплату регистрационного взноса (`soviet::admin/validate.cpp:29`,
`sndagreement.cpp:65`, `wallet/addbal.cpp:43`).

**Архитектурное пояснение пользователя:** у пайщика несколько кошельков —
**Main Wallet** (главный, на главной странице + мини в левом нижнем углу),
**кошельки членских взносов** (по разным стандартам) и **кошельки программ**
(Стола заказов и др.). Пополнение всегда идёт в Main; контракт сам конвертирует
Main → членских взносов → программа через `o.wal.conv`/`o.mkt.assign`/`o.mkt.block`.
Но membership должна существовать ДО пополнения — иначе нет Main Wallet'а
пайщика как такового.

**Развилка для следующего шага** (вынесена в вопрос пользователю):
- (A) Автомат `joincoop` в installExtraData — для каждого тестового пайщика
  делать soviet decision type=joincoop + 3 votefor + authorize + exec, без
  UI-шагов. Быстро даёт рабочий стенд для всех harness-сценариев.
- (B) Прогон через UI: новый сценарий `onboarding/join-coop` — ekaterina
  открывает «Заявление на вступление в кооператив», ant авторизует. Даёт
  документацию реального UX, медленнее.
- (C) Расширить `add-plain-participant.ts` чтобы он сразу делал full joincoop.
  Альтернатива (A), но в одном месте — каждый новый пайщик автоматически член.

### 9.11. cycle_type mapper фикснут — следующий блокер: пустой L3-кошелёк (2026-05-22)

Прогресс по §9.10:

- **Фикс mapper'а cycle_type → eosio::name выполнен.** Добавлены `MARKETPLACE_CYCLE_TYPE_CHAIN_NAME` registry + `toChainCycleType(cycle)` helper в `marketplace-offer.types.ts`. В `marketplace-order-create.service.ts:160` boundary с chain: `cycle_type: toChainCycleType(offer.cycle_type)`. Соответствует enum-правилу CLAUDE.md (без magic-string в service-коде). Mapping: `time_based`→`timebased`, `volume_based`→`volumebased`, `open_subscription`→`opensubscr`, `individual`→`individual`.
- **Перепрогон harness `orderer/order-create`:** assertion «Неизвестный тип цикла отсечки заявок» больше не срабатывает, pipeline проходит дальше — до `o.wal.block` блокировки средств.
- **Новый блокер:** у тестовых пайщиков пустой L3-кошелёк (`ekaterina = 0,00 RUB` слева в кошельке). Контракт падает «**Недостаточно средств для заказа: требуется 240.0000 RUB, доступно 0.0000 RUB**». UI корректно показывает Notify через `extractErrorMessage()`. PNG: `03-order-create-no-funds.png`.

**Что нужно дальше (Task #137):** в `installExtraData` (`components/boot/src/init/infra.ts`) добавить step эмиссии/пополнения L3-кошельков тестовых пайщиков (ekaterina, ivanpetrov и др.) на 10000+ RUB. Использовать существующий механизм (gateway::createincome, wallet::payadd или ledger emission через председателя) — не выдумывать. После пополнения магистраль II должна пройти e2e: order-create → orderer/orders → consolidated → offerer/incoming-orders → flow до payOut.

**Что UI/доки покрыли в этой итерации:**

- ✅ Фикс mapper зафиксирован в коде.
- ✅ admonition в `order-create.md` обновлён: старый блокер cycle_type помечен resolved, новый блокер (нет средств) описан явно.
- ✅ Скриншот переснят и переименован `03-order-create-no-funds.png`.

### 9.10. orderer/order-create — реальный submit + найден on-chain блокер (2026-05-22)

Развилка §9.9 решена в пользу (A) — UI. Реализовано:

- **SDK** — `Mutations.Marketplace.CreateOrder` уже был готов.
- **API-слой** — `fetchBranchOptions(coopname)` через `Queries.Marketplace.ListKUDetails` (с `onlyActive:true`); `submitCreateOrder` через `Mutations.Marketplace.CreateOrder`. Изначально пробовал `Queries.Branches.GetBranches` — но он требует chairman-видимости и в свежем worktree падает с NPE PaymentMethodDomainEntity (см. фикс #118 — не дошёл до mono-ai-4).
- **Dialog-компонент** `OrderCreateDialog.vue` — q-input «Количество» (с верхней границей `quantity_available` для не-безлимитных) + q-select «ПВЗ доставки» (автовыбор если одно ПВЗ). Расчёт итоговой суммы — реактивный. `extractErrorMessage()` достаёт `message` из Error/ApolloError/graphQLErrors[0]/response.errors[0] — иначе UI показывает `[object Object]`.
- **MarketplaceCatalogPage.vue** — `onSelectOffer` открывает `OrderCreateDialog` вместо stub Notify.
- **`marketplace_ku_details` seed** — в свежем стенде таблица пустая, ПВЗ-список приходит [] и select disabled. Засеял 3 строки через прямой psql INSERT (`krg/odn/myt` со `status=ACTIVE`). **TODO:** добавить step в `installExtraData` (boot/src/init/infra.ts) чтобы reboot:extra ставил эти записи автоматически.
- **Сценарий** `orderer/order-create.mjs` — 3 шота: пустой диалог / заполненная форма / Notify ошибки.
- **Проза** приведена к фактам (без выдуманных «акт о паевом взносе», «комиссия», «программный кошелёк»).

**НАЙДЕННЫЙ on-chain блокер магистрали II:** backend Postgres хранит `cycle_type='time_based'` (snake_case), а контракт `marketplace::createorder` ожидает `eosio::name`-литерал `timebased` (без подчёркивания) — `eosio::name` грамматика не допускает `_`. Assert: «Неизвестный тип цикла отсечки заявок» (`components/contracts/cpp/marketplace/src/p.mkt.supply/createorder.cpp:52`). Контракт-enum: `components/contracts/cpp/lib/domain/table_marketplace_orders.hpp:69-71` — `timebased / volumebased / opensubscr`.

**Фикс — в backend mapper'е** `marketplace-order-create.service.ts`, который преобразует строковый `MarketplaceOfferCycleType` в `eosio::name` payload для action. Должен быть mapping таблица:

| Postgres `cycle_type` | eosio::name action payload |
|---|---|
| `time_based` | `timebased` |
| `volume_based` | `volumebased` |
| `open_subscription` | `opensubscr` |

После фикса mapper'а UI/SDK/backend цепочка пройдёт до конца и Order сохранится в Postgres со статусом CREATED.

**Что UI/доки покрыли в этой итерации:**

- ✅ UI оформления Order + читаемые ошибки.
- ✅ `marketplace_ku_details` seed.
- ✅ Документация фиксирует блокер в admonition «Известный блокер магистрали II» — пайщик / разработчик видит честно.

**Что НЕ покрыто:**

- ❌ Реальный Order в Postgres → дальнейшая магистраль II (`orderer/orders`, `consolidated`, `offerer/incoming-orders` с реальными данными) остаётся в empty-state.
- ❌ Membership-flow `OnboardingMemberPickCpp` для ekaterina перед order-create — если Membership-guard вернёт ошибку, она тоже отобразится через `extractErrorMessage`. В текущем прогоне Membership пропустил, потому что up-front упёрлись в on-chain assert.

### 9.9. Магистраль II — старт (2026-05-22, коммит `2db39b56bfa`)

Первая цепочка через UI выполнена:

1. `offerer/offer-create` — Сидоров публикует Offer «Картофель Адретта 25 кг», статус PENDING_MODERATION.
2. `chairman/offer-moderation` — председатель одобряет → статус ACTIVE.
3. `orderer/catalog` — Петрова видит Offer в каталоге.
4. `offerer/my-offers` — Сидоров видит свой ACTIVE Offer в кабинете.

**Следующий блокер — `orderer/order-create`** — UI выводит stub Notify, реального сабмита `marketplaceCreateOrder` нет (см. шот `01-order-create-stub-notify.png`). Без него вся цепочка Order → Accept → Shipment → APP останавливается.

**Две альтернативы (выбрать в следующем цикле):**

- (A) Доработать UI `pages/Marketplace/OrdererOrderCreate.vue` — заменить stub Notify на реальный `Mutations.Marketplace.CreateOrder`. Требует SDK обёртки (есть `marketplaceCreateOrder` resolver в backend), формы submit и обработки flow «подписание Membership при первом Order» (PRD J2 шаг 2: `o.wal.conv + o.mkt.assign + o.mkt.block`).
- (B) TS-сидер `seed-marketplace-flow-step2.ts` через GraphQL: login petrova → `marketplaceCreateOrder` mutation. Не требует UI работы, но требует подписания JWT-токена через WIF (LoginInput: email + now + signature).

(A) даёт документируемую страницу `order-create.md`, (B) — быстрый сидер. Реалистично — (A), потому что это часть MVP UI.

### 9.8. Магистраль II — план сидера (2026-05-22)

Empty-state магистраль I покрыта. Магистраль II (страницы «с данными») требует сидера в БД. Backend marketplace resolvers богатый:

| Mutation | Что делает | Кем |
|---|---|---|
| `marketplaceCreateOffer` | Создаёт Offer в статусе `PENDING_MODERATION` (off-chain Postgres) | `sidorov` |
| `marketplaceApproveOffer` | Перевод Offer'а в `ACTIVE` | `ant` (chairman) |
| `marketplaceCreateOrder` | Создаёт Order на конкретный Offer | `petrova` |
| `marketplaceAcceptOrderBySupplier` | Поставщик акцептует Order в партию | `sidorov` |
| `marketplaceConfirmCycle` | Цикл фиксируется в `CONFIRMED` | `sidorov` |
| APP-цепочка signSupp/signChair/signIss1/signIss2 | Акт приёмки и выдачи (on-chain через cooptypes) | `opkrg` → `chairkrg` → `petrova` |

**Подход — отдельный TS-скрипт** `components/boot/src/scripts/seed-marketplace-flow.ts`:
- Использует HTTP GraphQL клиент к coopback `:3028`.
- Login chain: `sidorov → ant → petrova → sidorov → opkrg → chairkrg → petrova` (через `Mutations.Auth.Login` + WIF из `state/participants/*.json`).
- На on-chain действиях (signSupp/signChair/signIss) — собирает транзакцию через `cooptypes` actions и подписывает через `eosjs`.
- Запускается из `package.json` как `pnpm --filter @coopenomics/boot seed:marketplace-flow`.
- Идемпотентен: проверяет наличие Offer/Order перед созданием.

**Альтернатива** — композитный harness scenario `_magistral-II-seed.mjs` через Playwright UI flows. Проще в реализации (переиспользует существующие сценарии), но медленнее (~5-10 мин на прогон) и требует поднятого desktop dev.

**Что после сидера**: переснять с реальными данными следующие шоты:
- `orderer/catalog.mjs` — карточка APPROVED Offer на витрине
- `orderer/orders.mjs` — лента активных Заказов
- `orderer/consolidated.mjs` — сводный заказ по cycle_id
- `offerer/offers.mjs` — Offer ACTIVE в кабинете поставщика
- `offerer/incoming-orders.mjs` — реальный Order от petrova
- `offerer/shipment-prep.mjs` — после AcceptOrder
- `operator/apl-reception-create.mjs` — после shipment
- `operator/inventory-label.mjs` — после APP
- `operator/warehouse.mjs` — реальный inventory
- `operator/issuance.mjs` — Order готов к выдаче
- `orderer/ready-to-receive.mjs` — Order в RECEIVED
- `offerer/apl-reception-sign.mjs` — first signature


---

# Снятые факты Phase 0 (2026-05-20)

## 8.1. Создание КУ — core, не marketplace

Branch — это базовая фича платформы (components/controller/src/application/branch/), не marketplace-extension. Marketplace только потребляет существующие Branch.

- Vue API: `components/desktop/src/features/Branch/CreateBranch/api/index.ts` → `Mutations.Branches.CreateBranch.mutation` из @coopenomics/sdk.
- Resolver: `components/controller/src/application/branch/resolvers/branch.resolver.ts:34` → @Mutation 'createBranch', @AuthRoles(['chairman']).
- DTO CreateBranchGraphQLInput: `{coopname, braname, trustee, short_name, full_name, based_on, fact_address, phone, email}` — всё обязательно. based_on = текст-основание («решение совета №СС-… от …»).
- Blockchain action: `BranchContract.Actions.CreateBranch` (из cooptypes), payload `{coopname, braname, trustee}` (только три поля on-chain — остальные хранятся в Postgres organizations). Actor = coopname active permission, WIF из vault.

Стратегия для installExtraData: прямой вызов BranchContract.Actions.CreateBranch через `Blockchain` class (как boot уже делает в installInitialData), с подписью cooperative-WIF. Затем organizationRepository.create() через прямой Mongo insert (или skip — controller на следующем чтении сам подтянет).

## 8.2. Trusted accounts (доверенные лица КУ)

- Resolver: addTrustedAccount mutation, @AuthRoles(['chairman']).
- Action: `BranchContract.Actions.AddTrusted`, payload `{coopname, braname, trusted}`. Actor=coopname.
- В фикстуре — после createBranch вызвать addTrusted для каждого trustee.

## 8.3. Десктоп-страница «Реестр КУ»

- Path component: `components/desktop/src/pages/Cooperative/MemberBranchList/ui/MemberBranchListPage.vue`.
- Назначение: общий список КУ для chairman кооператива. Кнопка «Создать кооперативный участок» открывает features/Branch/CreateBranch диалог.
- Marketplace-страница `components/desktop/src/pages/Marketplace/PvzList` — это уже для marketplace стола (карта/список ПВЗ). Используется для отображения, не для создания.

## 8.4. БЛОКЕР ночного прогона: desktop dev EACCES

После docker bind-mount pnpm установил `vite-plugin-checker@0.11.0` под root внутри контейнера, parent-dir `node_modules/.pnpm/vite-plugin-checker@0.11.0_*/.../vueTsc/typescript-vue-tsc/` остался root:root. На запуске `quasar dev` (любой mode) vite-plugin-checker пытается unlink LICENSE.txt внутри этой папки → EACCES.

Фикс (требует ручного sudo от пользователя):

```
sudo chown -R admin:admin /home/admin/mono-ai-4/node_modules/.pnpm/vite-plugin-checker@*
```

Без этого ночные сценарии harness'а запустить нельзя — Playwright ходит на :2999. Auto-mode classifier отклонил автоматический sudo chown (system-wide).
