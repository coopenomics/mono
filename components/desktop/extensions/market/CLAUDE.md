# Marketplace extension — правила для агентов

Этот файл загружается при работе агентов в директории `components/desktop/extensions/market/`,
`components/desktop/src/pages/Marketplace/`, `components/desktop/src/widgets/Marketplace/`.

## Дизайн-система Стола Заказов (Эпик 10)

**Канон UI-компонентов** — `src/widgets/Marketplace/*`. На 2026-05-15 в каноне:

| Компонент              | UX-DR | Story        | Назначение                                          |
|------------------------|-------|--------------|-----------------------------------------------------|
| `CatalogOfferCard`     | DR10  | Story 10.2.4 | Карточка Offer в каталоге (Витрина, Эпик 3)         |
| `OrderCard`            | DR9   | Story 10.2.3 | Карточка заказа, per-роль actions (Эпики 4-9)       |
| `TakeoverDialog`       | DR7   | Story 10.2.1 | Full-screen takeover для критических действий       |
| `WalletTimeline`       | DR8   | Story 10.2.2 | Лента движений кошелька (Эпики 4, 9)                |
| `BarcodeScanner`       | DR11  | Story 10.2.5 | Сканер штрих-кода (operator-стол)                   |
| `BarcodeDisplay`       | DR12  | Story 10.2.6 | SVG-рендер штрих-кода для печати                    |
| `CorrectionTable`      | DR13  | Story 10.2.7 | Таблица корректировки факт vs план                  |
| `ExpeditorGroupingBoard` | DR14 | Story 10.2.8 | Доска группировки заявок (drag-n-drop)              |
| `TTNPrintPreview`      | DR15  | Story 10.2.9 | Печатная ТТН А5 со штрих-кодом                      |
| `WarehouseSummaryGrid` | DR16  | Story 10.2.10| Сводный склад admin-стола                           |
| `OnboardingCPPGate`    | DR17  | Story 10.2.11| L3-gate онбординга со списком документов            |
| `MultiChannelStatus`   | DR18  | Story 10.2.12| Статус push/email/SMS                               |
| `KUMapWithList`        | Эпик 2.3 | Story 10.2.13 | Карта ПВЗ + список (canon из widgets/KUMapWithList) |

## Жёсткие правила

1. **Inline-вёрстка кастомного UI-элемента запрещена.** Если в story нужно отобразить карточку
   заказа, статус доставки, диалог подтверждения и т.д. — импортируйте соответствующий
   компонент из `widgets/Marketplace/*`. Не дублируйте вёрстку под другим именем.

2. **Дизайн-токены — только через `marketplace-tokens.scss`.** Не хардкодьте цвета,
   spacing, touch-targets, font-size. Используйте CSS-переменные:
   `var(--mp-space-md)`, `var(--mp-touch-target-pos)`, `var(--mp-font-body)` и т.д.
   Палитра `$primary` / `$secondary` / `$accent` приходит из Quasar variables.

3. **Per-роль вариация через корневой класс.** На странице каждого стола обёртка
   получает `mp-role-orderer` / `mp-role-offerer` / `mp-role-operator` / `mp-role-admin` —
   токены автоматически переключаются (плотность, touch-target, font-size).

4. **Новый UI-компонент — в `widgets/Marketplace/<Name>/`.** Если в текущей story
   возникла необходимость в новом reusable-компоненте, его добавляют в
   `widgets/Marketplace/<Name>/` и используют в функциональных экранах после
   визуального одобрения владельцем продукта. (Страница-витрина дизайн-системы
   удалена — отдельной демо-секции под компонент заводить не нужно.)

5. **Расширение API существующего компонента — в самом компоненте.** Если
   функциональной story не хватает props/slot — добавьте их в компонент
   `widgets/Marketplace/<Name>/` и используйте в экране. Не создавайте
   wrapper'ы с дополнительной логикой «снаружи».

## GraphQL: только Zeus-клиент, никаких raw-строк

В desktop **запрещено** отправлять GraphQL операции сырыми строками через `sendPOST('/v1/graphql', { query: '…' })`. Это типобезопасный долг: ломается на schema drift, не покрывается tsc, теряет автогенерируемые типы.

**Канонический поток подключения новой query/mutation:**

1. В `components/controller/` добавить/изменить GraphQL DTO (`@InputType`, `@ObjectType`, resolver) — серверная схема обновляется code-first.
2. В `components/controller/`: `pnpm run generate-schema` → перегенерирует `controller/schema.gql` (snapshot текущей схемы).
3. В `components/controller/`: `pnpm run generate-client` → запускает graphql-zeus, кладёт сгенерённый клиент в `components/sdk/src/zeus/`.
4. В `components/sdk/`: `pnpm run build` → unbuild собирает `dist/` для потребителей (desktop тянет `@coopenomics/sdk` локально).
5. В `desktop` использовать типизированные обёртки из `@coopenomics/sdk`:
   - `Mutations.Marketplace.<Name>(input)` для write-операций
   - `Queries.Marketplace.<Name>(input)` для read-операций
   - `Client.login(...)` / `Mutations.Auth.Refresh` для сессии — никогда не дёргать `LoginInput` напрямую.

**Запрещено:** оставлять `const QUERY = '\n  query ...'` со sendPOST в `pages/Marketplace/*/api/index.ts` со ссылкой «техдолг до Zeus». Если schema не покрывает поле — сначала шаг 1-4, потом UI. Заглушка не мерджится.

## Связанные документы

- Спецификация Эпика 10: `_blago/production/1-prilozhenie-stol-zakazov/components/3-minimalnyy-produkt/issues/598-13-epik-10-*-requirements/`
- UX-спецификация MVP: `_blago/production/1-prilozhenie-stol-zakazov/components/3-minimalnyy-produkt/requirements/7e-uxui-spetsifikatsiya-stol-zakazov-mvp.md`
- Архитектура MVP: `_blago/production/1-prilozhenie-stol-zakazov/components/3-minimalnyy-produkt/requirements/d6-arkhitektura-stol-zakazov-mvp.md`
