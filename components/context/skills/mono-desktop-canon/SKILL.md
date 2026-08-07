---
name: mono-desktop-canon
description: >-
  Канон вёрстки desktop цифрового кооператива (mono, components/desktop).
  Обязывает собирать экраны из shared/ui/base (BaseButton/BaseInput/BaseSelect/BaseCard/BaseTable/BaseChip/BaseBadge/BaseDialog/BaseBanner/BaseForm/BaseCheckbox/EmptyState…),
  shared/ui/domain (WalletCard/DataRow/DocumentRow/IdentityPanel/PersonCard/SignatureCard/VerticalStepper/FilterBar…)
  и shared/ui/layout (AppDrawer/AppHeader/PageHead/PageTabs) вместо прямых q-input/q-btn/q-card/q-table/q-chip/q-dialog/q-select.
  Цвета/отступы/типографика — токены --p-* (src/css/mono-platform/tokens.css) и Quasar utility-классы, без хардкод-hex/px.
  Иконки — q-icon с Material-именами; FontAwesome запрещён. Эталон — /_dev/ui.
  Use when creating or editing any .vue/.scss in components/desktop (core + extensions/*),
  or when the user mentions «вёрстка десктопа», «канон дизайна», «defui», «базовые компоненты»,
  «переведи на канон», MONO Platform v2, mono-desktop-canon.
---

# Канон вёрстки desktop «Цифровой Кооператив» (MONO Platform v2)

Это описание **реально внедрённой** дизайн-системы в `components/desktop` (ветка `marketplace2`/`dev` — она одна). **Каждый раз** при создании или правке UI соблюдай правила ниже; старое замечаешь — заменяешь попутно. Это жёсткий стандарт, не «по возможности».

**Где живёт канон (источники истины в репозитории):**

| Что | Путь |
|---|---|
| Токены палитры/типографики/spacing/radii (`--p-*`) | `src/css/mono-platform/tokens.css` |
| Прототип-классы компонентов + typography-утилиты `.t-*` | `src/css/mono-platform/components.css` |
| Оверрайды Quasar-компонентов под канон | `src/css/mono-platform/quasar-canon.css` |
| Минимальная SCSS-палитра Quasar (`$primary`, `$dark`) | `src/css/quasar.variables.scss` |
| Базовые обёртки | `src/shared/ui/base/` |
| Доменные компоненты | `src/shared/ui/domain/` |
| Layout-шелл страниц | `src/shared/ui/layout/` |
| **Живой эталон (открывать в браузере `/_dev/ui`)** | `src/pages/_dev/ui/index.vue` |

Все три `mono-platform/*.css` подключены глобально в `quasar.config.cjs` (`css: [...]`) — токены и стили доступны везде без импортов. **При сомнении в каноне — открой `tokens.css` и `_dev/ui/index.vue` и смотри, как сделано там.**

Связанные правила проекта: строгие Zeus-типы (`SuccessAlert`/`FailAlert`); дублирование UI → вынос в `shared`; type-check делегируется CI (локальный `tsc` не крутить без запроса).

## Правило №1 (главное): экран собирается из готовых компонентов, не из сырого Quasar

В `features/`, `widgets/`, `pages/`, `processes/`, `entities/` и в `extensions/*` **запрещено** использовать Quasar-компоненты, у которых есть обёртка. Бери обёртки из `shared/ui/base`, доменные блоки — из `shared/ui/domain`, каркас страницы — из `shared/ui/layout`.

| ❌ Прямой Quasar (старое) | ✅ Обёртка (канон) |
|---|---|
| `q-input` | `BaseInput` |
| `q-btn` | `BaseButton` |
| `q-select` | `BaseSelect` |
| `q-card` | `BaseCard` |
| `q-table` | `BaseTable` |
| `q-chip` | `BaseChip` |
| `q-badge` | `BaseBadge` |
| `q-dialog` / `ModalBase` | `BaseDialog` |
| `q-banner` | `BaseBanner` |
| `q-form` / старый `Form` | `BaseForm` |
| `q-checkbox` (с валидацией/каноном) | `BaseCheckbox` |
| `AutoAvatar` | `Avatar` |
| `ToogleDarkLight` | `ThemeToggle` |
| пустой экран россыпью | `EmptyState` |
| ручной скелетон таблицы | `TableSkeleton` |

Импорт — из единой точки:

```ts
import { BaseButton, BaseInput, BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base';
import { WalletCard, DataRow, DocumentRow, VerticalStepper } from 'src/shared/ui/domain';
import { PageHead, PageTabs } from 'src/shared/ui/layout';
```

**Доменные компоненты (`shared/ui/domain`)** — для повторяющихся смысловых блоков, которых нет в Quasar: `WalletCard`, `IdentityPanel`, `PersonCard`, `AccountBadge`, `DataRow`, `DocumentRow`, `DocumentSignatures`, `SignatureCard`, `DocumentPreview`, `ActivityTimeline`, `VerticalStepper`, `AmountInput`, `OtpInput`, `FilterBar`, `FileUploader`, `DetailsDrawer`, `CommandPalette`, `NotificationCenter`, `ContactSheet`, `RailUserCard`, `AuthCard`. **Layout (`shared/ui/layout`):** `AppDrawer`, `AppHeader`, `PageHead`, `PageTabs`. Прежде чем верстать «карточку кошелька», «строку документа», «панель личности» руками — проверь, нет ли готового домен-компонента.

Точные экспорты и props — в [REFERENCE.md](REFERENCE.md) и в `*.types.ts` рядом с компонентом. **Никогда не угадывай props — открой `shared/ui/<base|domain|layout>/<Имя>/<Имя>.types.ts` и читай реальный API.**

**Голый Quasar допустим только там, где обёртки нет:** `q-icon`, `q-img`, `q-toggle`, `q-radio`, `q-list`, `q-item`, `q-menu`, `q-tooltip`, `q-tabs`, `q-stepper`, `q-uploader`, `q-separator`, `q-tree`, `q-date`, `q-spinner`, `q-linear-progress`, `q-skeleton`, `q-inner-loading`, `q-carousel`, `q-space`. Полный список — в [REFERENCE.md](REFERENCE.md).

## Правило №2: spacing/сетка/типографика — utility-классы и токены, без хардкод-px

- Отступы → `q-pa-md`, `q-px-sm`, `q-mt-lg`, `q-gutter-md`, `q-col-gutter-md`. В кастомном CSS — токены `var(--p-4)` (16px), `var(--p-3)` (12px) и т.д. (шкала `--p-1`=4px … `--p-10`=72px). Никаких `style="padding: 13px"`.
- Сетка → `.row.q-col-gutter-md` + `.col-12.col-md-6`. Не плодить самопальный CSS-grid там, где хватает row/col.
- Радиусы → токены `var(--p-r-sm|md|lg|xl)` (8/12/16/20px), `--p-r-pill`. Не хардкодить.
- Типографика → Quasar `text-h1..h6`/`text-body1/2`/`text-caption`/`text-weight-*` **или** classes `.t-display/.t-mono/.t-sm/.t-muted` из `components.css`, **или** токены `--p-fs-*`/`--p-lh-*` в кастомном CSS. Иерархия — размером и весом, **не цветом**.

## Правило №3: цвет — только токены `--p-*`, utility-классы или color-props; никаких сырых hex

- В шаблоне — `color="primary"`, utility `bg-primary`/`text-primary`/`text-positive`/`text-negative`/`text-warning`/`text-grey-7`. Quasar красит их в канон-палитру автоматически (токены проброшены в `--q-*`).
- В `<style>` — **только токены `--p-*`**: поверхности `--p-canvas/--p-surface/--p-surface-2/-3`, текст `--p-ink/--p-ink-2/--p-ink-3`, линии `--p-line/--p-line-1/-2`, акцент `--p-primary` (+ `-hover/-press/-soft/-line`), статусы `--p-pos/--p-neg/--p-warn/--p-info` (+ `-soft`), тени `--p-shadow-card/-pop/-modal`.
- **Никогда** `color: #1976d2`, `background:#fff`, свой `rgba(...)`. Темы light/dark переключаются сами через `[data-theme]` на `<html>` — токены `--p-*` следуют за темой, сырой hex нет (это и есть «сломанный dark»).
- Шрифты руками не писать — наследуются (`--p-sans` = Inter, `--p-mono` = JetBrains Mono). Моноширинный для чисел/хэшей/ID — класс `.t-mono`/`.t-mono-sm` или `font-family: var(--p-mono)`.

## Правило №4: иконки — `q-icon` с Material-именами

Иконки рисуются через `q-icon(name='...')` именами **Material Icons** (дефолтный `iconSet` Quasar): `dashboard`, `search`, `refresh`, `arrow_back`, `arrow_forward`, `close`, `info`, `error`, `visibility_off`, `local_shipping`, `touch_app` и т.п. Так делает весь канон (`AppDrawer`, layout, домен-компоненты).

**Запрещён FontAwesome** (`fa-solid fa-*`, `fa-regular …`) — он подключён в `extras` как легаси и встречается в старом коде marketplace; при правке заменяй `fa-*` на Material-эквивалент. Material-emoji-как-данные тоже нельзя.

## Правило №5: четыре инварианта

1. **Hairline borders, без теней** на flat-карточках (`--p-line` 1px). Тень (`--p-shadow-*`) — только на overlay: `BaseDialog`, `q-menu`, `DetailsDrawer`, command palette.
2. **Основной цвет — deep teal** `--p-primary` (light `#0f766e`, dark `#2dd4bf`). Тёплый terracotta `--p-accent` существует, но **только для редких акцентов** (ссылки-идентификаторы, инлайн-подсветки) — не как фон кнопок, не как «второй бренд-цвет», `bg-secondary`/`bg-accent` не применять.
3. **Cool neutrals.** Поверхности/текст/линии — из `--p-surface*`/`--p-ink*`/`--p-line*`. Status-цвета — только в чипах/баннерах/бейджах, не как фоны страниц.
4. **Inter + JetBrains Mono** (`--p-sans`/`--p-mono`). Никакого Roboto/Cormorant/Manrope в качестве акцентных шрифтов.

## Per-program цвета

`--prog-blagorost` / `--prog-wallet` / `--prog-generator` (+ `-soft`) — **только** на иконке-плитке `WalletCard`. Не в чипах, баннерах, фонах карточек или страниц.

## Структура страницы (повторяющиеся правки — делать сразу, не ждать тычка)

Каждая страница раздела собирается однотипно. Не отступать без причины:

1. **Заголовок страницы — НЕ дублировать.** Он уже выводится в топбаре (`route.meta.title` / `desktopStore.pageTitleOverride`). Не добавлять на страницу свой `<h1>` с тем же текстом. Никаких `page__title`/`offer-wizard__title` с именем страницы.
2. **Одна карточка-подсказка на страницу.** Поясняющие тексты не раскидывать отдельными `<p>`-абзацами и не делать цветные `q-banner`. Весь вводный/справочный текст — в **одну** канон-карточку `.banner` (`.banner--info`/`--neg`/`--warn` по смыслу, иконка в `.banner__icon`, текст в `.banner__body`). Два смысловых куска — объединять в одну карточку, не плодить.
3. **Главные действия страницы — в правый верхний угол** (через `useHeaderActions`, телепорт в топбар): «Создать», «Снять с публикации» и т.п. Не пунктом меню, не кнопкой посреди контента.
4. **Навигация формы/мастера — липкий нижний бар.** Кнопки «Отменить/Назад» (слева) и «Далее/Сохранить» (справа) прибиты к низу экрана (`position: sticky; bottom: 0` + `background: var(--p-canvas)` + `border-top: 1px solid var(--p-line)`), всегда на виду — не на дне прокрутки.
5. **Статус сущности** (чип `BaseChip` с variant по статусу) — вверху страницы, в строке со справа-прижатыми действиями. Не как отдельная цветная «карточка статуса».
6. **Списки-таблицы — canon `.table-wrap`, не `q-table`.** Структура `.table-wrap > .table-scroll > table.table` (`thead/th` + `tbody/td`); эталон — `widgets/Cooperative/Payments/.../ListOfPaymentsWidget.vue`, `Documents/.../DocumentsTable.vue`. Статус в ячейке — `BaseBadge` с variant (`pos/neg/warn/info/neutral`) через map `статус → {label, variant}`. Действия в строке — `BaseButton`/`.icon-btn`. Пусто — `EmptyState` (с `#icon`). Низ — `.table-foot` с диапазоном + «Загрузить ещё». (`BaseTable`-обёртка существует, но скелетон `TableSkeleton` структурно совпадает именно с сырой `.table`.)
7. **Загрузка — скелетон, не спиннер.** Списки/таблицы: `TableSkeleton`/`.skel`-каркас (колонки повторяют шапку), `v-if='loading && !items.length'`; polling обновляет молча. Никаких `q-inner-loading`+`q-spinner` поверх контента — «дёргание раздражает».
8. **Скрываемый баннер — общий composable** `useDismissibleBanner('mp:<page>:banner-dismissed')` (`{ dismissed, dismiss }`, persist в LocalStorage, синхронное чтение — не восстанавливать на onMounted). Не дублировать LS-логику в каждой странице.

## Stop-signals — СПРОСИ пользователя, прежде чем отступать

1. Цветной фон карточки (платформа — neutral surfaces).
2. Второй бренд-цвет / использование `--p-accent` как заливки кнопок.
3. Serif-заголовок, «premium», italic-accent, warm cream (landing-регистр, retired).
4. Чипы «Подписан / Не подписан» на документах (в реестре всё подписано по определению).
5. Новый шрифт кроме Inter / JetBrains Mono.
6. `box-shadow` на flat-карточке.
7. Новый словарь токенов или сырой hex/px вместо `--p-*`. Легитимны: `--p-*` (канон), `--q-*` (Quasar, автогенерация — не трогать), `--prog-*`. **Запрещены/удаляются:** `--mp-*` (старая marketplace-надстройка `marketplace-tokens.scss`), `--tr-*`, `--ds-*`.
8. FontAwesome-иконка (`fa-*`) вместо Material `q-icon`.
9. Прямой `q-input`/`q-btn`/`q-dialog`/`q-table`/`q-card`/`q-select` в features/pages (нарушает Правило №1).

При архитектурном конфликте — стоп и спросить пользователя, не решать unilaterally.

## Рабочий цикл при правке/создании UI

1. **Перед написанием** — глянь `ls src/shared/ui/base`, `ls src/shared/ui/domain`, `ls src/shared/ui/layout`: есть ли готовый компонент. Открой эталон `_dev/ui/index.vue` — как там собран похожий экран.
2. **Не угадывай props** — читай `*.types.ts` обёртки.
3. **Замечаешь старое** в файле, что правишь (`q-input`/hex/inline-px, `--mp-*`/`--tr-*`, FontAwesome `fa-*`, gradient, bouncy-easing) — заменяй на канон попутно.
4. **После правки** — самопроверка: нет сырых `q-input/q-btn/q-card/q-table/q-chip/q-dialog/q-select` вне `shared/ui`; нет hex/inline-px; цвета/отступы — `--p-*` или utility; иконки — Material `q-icon`.

Полная карта экспортов, токенов, доменных компонентов и маппинги старое→канон — в [REFERENCE.md](REFERENCE.md).
