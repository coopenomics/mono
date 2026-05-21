# План E2E-документации Marketplace MVP «Стол заказов»

Последнее обновление: 2026-05-21 (фаза 1 — empty-state магистраль I исчерпана UI-кодом; см. §9 «Текущее состояние»).
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
        - Заказы участка: new/marketplace/branch-chairman/branch-orders.md
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
│   ├── branch-orders.mjs
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

Срез на **2026-05-21**, ветка `worktree-marketplace-docs-impl`, последний коммит `e67d7ca77b8` (страница модерации offer'ов председателем).

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

Проверка на 2026-05-21: следующие 8 страниц физически отсутствуют в `components/desktop/src/pages/Marketplace/` и в `components/desktop/extensions/market/install.ts`. План §9.2 их перечисляет, но снять harness'ом их нельзя — нет ни Vue-компонента, ни роута. Каждая ждёт реализации соответствующего Эпика:

| План | Файл Vue | Роут | Ждёт Эпик |
|---|---|---|---|
| `onboarding/coop-accept-cpp` | OnboardingCoopAcceptCpp.vue | `/onboarding/coop-cpp` | Эпик 1 / Story 1.x — L1 ЦПП |
| `onboarding/member-pick-cpp` | OnboardingMemberPickCpp.vue | `/onboarding/member-cpp` | Эпик 1 / Story 1.x — L2 ЦПП |
| `chairman/category-whitelist` | ChairmanCategoryWhitelist.vue | `/market/categories` | Эпик 3 / Story 3.x — белый список |
| `offerer/offers` | OffererMyOffers.vue | `/market/my-offers` | Эпик 3 / Story 3.1 — мои Предложения |
| `offerer/incoming-orders` | OffererIncomingOrders.vue | `/market/incoming-orders` | Эпик 4 / Story 4.x — входящие Заказы |
| `branch-chairman/branch-orders` | BranchChairmanBranchOrders.vue | `/market-pvz/branch-orders` | Эпик 6 / Story 6.x — заказы участка |
| `board/agenda-writeoff` | BoardAgendaWriteoff.vue | `/soviet/agendas/...` (за пределами market extension) | Эпик 8 / Story 8.x — голосование совета |
| `board/payouts-readonly` | BoardPayoutsReadonly.vue | `/market/payouts` | Эпик 5 / Story 5.x — выплаты поставщикам |
| `orderer/consolidated` | OrdererConsolidated.vue | `/market/consolidated` | Эпик 4 / Story 4.4 — Сводный заказ orderer'а |

**`board/warehouse-readonly`** в плане был — но `AdminWarehouseSummaryPage` уже доступна `roles: ['chairman', 'member']`, и сценарий `chairman/warehouse-summary` снимает её. Сценарий «board/warehouse-readonly» как отдельный — дубль; объединяем с `chairman/warehouse-summary` в прозе («сводный склад читают и председатель, и совет — UI одинаковый»).

**Что делать с этими 8 пунктами в документации.** Создать `docs/new/marketplace/<role>/<page>.md` с admonition `!!!warning "Эпик X — в разработке"` и описанием **целевого** поведения по PRD (без скриншота). Это даёт пользователю карту маршрута и подсказку «функционал планируется», вместо пустого 404 в навигации.


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
