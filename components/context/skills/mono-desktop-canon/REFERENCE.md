# REFERENCE — канон вёрстки desktop «Цифровой Кооператив» (MONO Platform v2)

Детальный справочник к `SKILL.md`: точные источники истины **в репозитории mono**, токены, экспорты обёрток/доменных/layout-компонентов, маппинги старое→канон.

## Источники истины (всё в `components/desktop/`)

| Что | Путь |
|---|---|
| Токены: палитра, типографика, spacing, radii, тени, motion (`--p-*`) | `src/css/mono-platform/tokens.css` |
| Прототип-классы компонентов + typography-утилиты `.t-*` | `src/css/mono-platform/components.css` |
| Оверрайды Quasar (`q-btn`/`q-field`/`q-chip`…) под канон | `src/css/mono-platform/quasar-canon.css` |
| Минимальная SCSS-палитра Quasar (`$primary:#00695c`, `$dark`) | `src/css/quasar.variables.scss` |
| Базовые обёртки | `src/shared/ui/base/` (+ `index.ts`) |
| Доменные компоненты | `src/shared/ui/domain/` (+ `index.ts`) |
| Layout-шелл | `src/shared/ui/layout/` |
| **Живой эталон, открывать `/_dev/ui`** | `src/pages/_dev/ui/index.vue` |
| Подключение CSS глобально | `quasar.config.cjs` → `css: ['mono-platform/tokens.css', 'mono-platform/components.css', 'mono-platform/quasar-canon.css', …]` |

> **Важно про токены.** Палитра живёт в `tokens.css` как CSS-переменные `--p-*` (light в `:root,[data-theme="light"]`, dark в `[data-theme="dark"]`). Там же `--p-*` пробрасываются в Quasar: `--q-primary: var(--p-primary)` и т.д. — поэтому `color="primary"`, `bg-primary`, `text-positive` рисуются в канон-палитре сами. `quasar.variables.scss` **почти пустой** (только `$primary`/`$dark`) и НЕ является источником токенов. SCSS-`$`-переменные руками в кастомном CSS не используем — берём `--p-*`.

## Словарь токенов `--p-*` (из `tokens.css`)

**Поверхности:** `--p-canvas`, `--p-canvas-2`, `--p-surface`, `--p-surface-2`, `--p-surface-3`, `--p-overlay`.
**Текст (ink):** `--p-ink`, `--p-ink-1`, `--p-ink-2`, `--p-ink-3`, `--p-ink-4`, `--p-ink-on-primary`.
**Линии:** `--p-line`, `--p-line-1`, `--p-line-2`.
**Primary (deep teal):** `--p-primary` (light `#0f766e` / dark `#2dd4bf`), `--p-primary-hover`, `--p-primary-press`, `--p-primary-soft`, `--p-primary-line`, `--p-primary-strong`.
**Accent (редко, terracotta):** `--p-accent`, `--p-accent-soft`.
**Статусы:** `--p-pos`/`-soft`, `--p-neg`/`-soft`, `--p-warn`/`-soft`, `--p-info`/`-soft`.
**Per-program:** `--prog-blagorost`/`-soft`, `--prog-wallet`/`-soft`, `--prog-generator`/`-soft`.
**Тени (скупо):** `--p-shadow-card`, `--p-shadow-pop`, `--p-shadow-modal`, `--p-focus-ring`.
**Sidebar:** `--p-rail-bg`, `--p-rail-item-hover`, `--p-rail-item-active-bg`, `--p-rail-item-active-fg`, `--p-rail-rail-color`.
**Шрифты:** `--p-sans` (Inter), `--p-display` (Inter), `--p-mono` (JetBrains Mono).
**Type-scale:** `--p-fs-display|h1|h2|h3|body|body-sm|meta|eyebrow|mono|mono-sm` + парные `--p-lh-*`, `--p-ls-*`. Реальные размеры: display 34 / h1 24 / h2 18 / h3 15 / body 14 / body-sm 13 / meta 12 / eyebrow 11.
**Spacing (шаг 4):** `--p-1`=4 … `--p-6`=24, `--p-7`=32, `--p-8`=40, `--p-9`=56, `--p-10`=72.
**Radii:** `--p-r-xs`6 / `--p-r-sm`8 / `--p-r-md`12 / `--p-r-lg`16 / `--p-r-xl`20 / `--p-r-pill`999.
**Motion:** `--p-dur-fast|base|slow`, `--p-ease-standard`, `--p-ease-snappy`.
**Layout:** `--p-rail-w`=248px, `--p-topbar-h`=56px.

Легитимные префиксы CSS-переменных: `--p-*`, `--q-*` (Quasar, не трогать), `--prog-*`. Запрещены/удаляются: `--mp-*` (`marketplace-tokens.scss`), `--tr-*`, `--ds-*`.

## Экспорты `shared/ui/base` (импорт `from 'src/shared/ui/base'`)

| Компонент | Тип props (`*.types.ts`) | На базе |
|---|---|---|
| `BaseButton` | `BaseButtonProps`, `BaseButtonVariant` (`primary`/`secondary`/`ghost`/`danger`), `BaseButtonSize` | `q-btn` |
| `BaseInput` | `BaseInputProps` | `q-input` |
| `BaseSelect` | `BaseSelectProps`, `BaseSelectOption` | `q-select` |
| `BaseCheckbox` | `BaseCheckboxProps` | `q-checkbox` |
| `BaseRadioCard` | `BaseRadioCardProps` | карточка-radio |
| `BaseCard` | `BaseCardProps`, `BaseCardVariant` (`default`/`flat`/`inset`/`quiet`) | `q-card flat` |
| `BaseTable` | `BaseTableProps`, `BaseTableColumn` | `q-table` |
| `BaseChip` | `BaseChipProps`, `BaseChipVariant` (`neutral`/`accent`/`pos`/`neg`/`warn`/`info`), size `sm`/`lg` | `q-chip` |
| `BaseBadge` | `BaseBadgeProps`, `BaseBadgeVariant` | `q-badge` |
| `BaseDialog` | `BaseDialogProps`, `BaseDialogSize` | `q-dialog` |
| `BaseBanner` | `BaseBannerProps`, `BaseBannerVariant` | `q-banner` |
| `BaseForm` | `BaseFormProps` | `q-form` |
| `EmptyState` | `EmptyStateProps` (`title` обяз., `body?`) | вёрстка |
| `TableSkeleton` | `TableSkeletonProps`, `TableSkeletonColumn` | `q-skeleton` |
| `Avatar` | `AvatarProps`, `AvatarSize`, `AvatarTone` (бывш. `AutoAvatar`) | вёрстка |
| `ThemeToggle` | — (бывш. `ToogleDarkLight`) | `q-toggle` |

Контент кнопки/чипа — через дефолтный слот (у `BaseButton` нет prop `label`/`icon`; иконку класть слотом `icon-left`/`icon-right` или `q-icon` внутри). Перед использованием читай `*.types.ts`.

## Экспорты `shared/ui/domain` (импорт `from 'src/shared/ui/domain'`)

`AccountBadge`, `ActivityTimeline`, `AmountInput`, `AuthCard`, `CommandPalette`, `ContactSheet`, `DataRow`, `DetailsDrawer`, `DocumentPreview`, `DocumentRow`, `DocumentSignatures`, `FileUploader`, `FilterBar`, `IdentityPanel`, `NotificationCenter`, `OtpInput`, `PersonCard`, `RailUserCard`, `SignatureCard`, `VerticalStepper`, `WalletCard`.

Типы — рядом (`<Имя>/<Имя>.types.ts`), напр. `Identity`, `Person`, `DocumentRowDoc`, `Signature`, `ActivityEvent`, `StepperStep`, `FilterDefinition`, `NotificationItem`.

## Layout `shared/ui/layout`

`AppDrawer` (rail 248px, solid + accent-rail, иконки `q-icon name=`), `AppHeader` (topbar 56px), `PageHead` (заголовок страницы без подвкладок), `PageTabs` (sub-nav, бывш. `SecondLevelMenuList`/`SecondLevelTabs`).

## Используем НАПРЯМУЮ (обёртки нет — голый Quasar ок)

`q-icon`, `q-img`, `q-toggle`, `q-radio`, `q-date`, `q-time`, `q-color`, `q-spinner`, `q-linear-progress`, `q-skeleton`, `q-separator`, `q-tooltip`, `q-menu`, `q-list`, `q-item`, `q-expansion-item`, `q-tree`, `q-tabs`, `q-tab`, `q-stepper`, `q-uploader`, `q-carousel`, `q-inner-loading`, `q-space`, `q-btn-toggle` (нет обёртки). Стилизуются через канон-CSS + `color="primary"`.

## Иконки

`q-icon(name='<material>')` — дефолтный `iconSet: 'material-icons'` (см. `quasar.config.cjs`). Имена Material: `dashboard`, `search`, `refresh`, `close`, `arrow_back`, `arrow_forward`, `add`, `edit`, `delete`, `info`, `error`, `warning`, `check`, `visibility`/`visibility_off`, `local_shipping`, `touch_app`, `expand_more` и т.д. **FontAwesome (`fa-solid/fa-regular fa-*`) — легаси** (подключён в `extras` как `fontawesome-v6`, используется в старом marketplace-коде); при правке заменяй на Material-эквивалент.

## Маппинг прямых Quasar → обёртки

`q-btn`→`BaseButton`, `q-input`→`BaseInput`, `q-select`→`BaseSelect`, `q-dialog`/`ModalBase`→`BaseDialog`, `q-card`→`BaseCard`, `q-table`→`BaseTable`, `q-chip`→`BaseChip`, `q-badge`→`BaseBadge`, `q-banner`→`BaseBanner`, `q-form`→`BaseForm`, `q-checkbox`→`BaseCheckbox`.

## Маппинг старых токенов/значений → канон

| Старое | Канон |
|---|---|
| `var(--mp-space-xs..xl)` (4/8/16/24/32) | `q-pa-*`/`q-gutter-*` в шаблоне или `var(--p-1..7)` в CSS |
| `var(--mp-radius-sm/md)` | `var(--p-r-sm)` / `var(--p-r-md)` |
| `var(--mp-on-surface)` / `--tr-text` | `var(--p-ink)` или класс `text-dark` |
| `var(--mp-on-surface-muted)` / `--tr-muted` | `var(--p-ink-2)`/`--p-ink-3` или `text-grey-7` |
| `var(--mp-surface-0/1/2)` | `var(--p-surface)`/`--p-surface-2`/`--p-surface-3` или `bg-grey-1/2` |
| `var(--mp-border-*)` / `--tr-border` | `var(--p-line)` (1px hairline) |
| `mp-role-*` корневой класс | удалить (плотность не через role-классы) |
| `fa-solid fa-*` | `q-icon name='<material>'` |
| сырой `#hex` / `rgba()` | токен `--p-*` или utility-класс |

## Доменные правила

- **Wallet:** одно крупное tabular-число (объём в программе) + маленький hint снизу. Без stacked двойных чисел, без цветного фона карточки. Per-program цвет — только на иконке-плитке `WalletCard`.
- **Реестр документов:** в `BaseTable` нет колонки «Статус» (каждый документ подписан по определению). Строка — `DocumentRow` (eyebrow-тип + название + mono-ID). Очередь подписания — отдельная surface со своим статусом.
- **Voting:** За/Против/Воздержался = `BaseButton`×3, голос засчитывается сразу, без подтверждения.
- **Sidebar (`AppDrawer`):** solid surface, active = soft-accent fill (`--p-rail-item-active-bg`) + accent-rail. «Выйти» — `text-grey-7`, hover → `text-negative`.
- **Иерархия** — `text-h*`/`.t-*`/`--p-fs-*` + вес, не цвет.

## Что выведено из эксплуатации (retired — убирать попутно)

- FontAwesome v6, Material-emoji-как-данные → `q-icon` Material.
- `marketplace-tokens.scss` (`--mp-*`), `--tr-*`, `--ds-*` → токены `--p-*`.
- Cormorant Garamond / Manrope / Roboto-как-акцент → Inter.
- Warm cream токены, `<em>` italic teal landings, `.cap` 0.2em tracking (landing-регистр).
- `.hover-card` scale transforms → плоский hover (только bg).
- Bouncy easing `cubic-bezier(0.175,…1.275)` → `--p-ease-standard`.
- Gradient на active sidebar / dialog headers / member card → soft-accent + rail / hairline / `BaseCard`.
- Прямой `q-btn/q-input/q-dialog/q-table/q-card` в features/widgets/pages → обёртки.

## Именование

Имена компонентов/файлов/CSS-классов/SCSS-переменных/TS — **английские** (PascalCase компоненты, kebab-case CSS BEM). User-facing строки (label, заголовки) — **по-русски** (контент).
