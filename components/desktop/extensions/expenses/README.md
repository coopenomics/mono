# Expenses Extension — UI шасси расходов (C28-32)

**Статус:** живое — зарегистрировано в `extensions-registry`, backend C28-31 и контракт работают; первый прикладной потребитель — Благорост (`extensions/capital`, пул `w.cap.pgexp`).

## Как подключить пул расходов на новый стол (рецепт, 2026-06-12)

Шасси фабричное: контракт `expense`, backend и UI-виджеты переиспользуются без правок — настраивается только пул.

1. **Контракт/ledger2** (`cpp/lib/core/ledger2/`): кошелёк-пул (COOPERATIVE) в `wallets.hpp`; 5 операций жизненного цикла (аванс/прямая/отчёт/возврат/перерасход) в `OPERATION_REGISTRY` + одна строка в `EXPENSE_OPERATION_SETS` (`operations.hpp`) — коды операций контракт `expense` выводит из `source_wallet` сам. Зеркала имён — `cooptypes/src/ledger2/{operations,processes}.ts` + локатор `controller/.../process-hash-locator.ts`.
2. **Создание СЗ**: либо generic-мутация `Mutations.Expense.CreateExpenseProposal`, либо своя обвязка по образцу `capital::createpgexp` (счётчики/резерв пула + inline `expense::createexp` с callback на финализацию).
3. **Страница стола**: собирается из общих доменных виджетов `ExpenseCreateDialog` (пропы `source-wallet` / `draft-key` / `submit`) + `ExpenseProposalList` — см. `src/shared/ui/domain/ExpenseCreateDialog/README.md`; эталон — `extensions/capital/pages/ProgramExpensesPage` (+ детальная `ProgramExpensePage`).
4. **Стол совета**: `registerExpenseWallet({ wallet, title, route, ... })` в `install.ts` расширения (`src/shared/lib/expense-wallets`) — этим имя пула резолвится в колонке «Кошелёк (пул)» реестра расходов совета (`ExpensesRegistryPage`, маршрут `soviet-expenses-registry`). Реестр показывает ВСЕ расходы кооператива по всем пулам без фильтра; фильтр по конкретному пулу — на странице расходов программы.
5. **Оплата/отчёты** работают сразу: реестр платежей, панели платёжки кассира (`features/Payment/AttachExpenseProof`) и отчёта пайщика (`features/Payment/ReportExpenseAdvance`), закрытие расхода советом — всё привязано к `proposal_hash`/`item_hash`, не к пулу.

## Фоновые сервисы (backend)

**Напоминатель об отчёте по авансу под отчёт** — `controller/src/extensions/expenses/application/services/expense-advance-reminder.service.ts`.

`@Interval`-воркер периодически сканирует зеркало расходов кооператива и находит `ADVANCE`-позиции в статусе `PAID` (аванс выдан пайщику, отчёт не подан). По каждому пайщику-получателю шлёт **один агрегированный недельный дайджест** (workflow `Workflows.ExpenseAdvanceReportReminder` в `@coopenomics/notifications`) со ссылками — на сам расход `/:coopname/expenses/:hash`, если он один, иначе на личную страницу «Платежи» `/:coopname/user/payments`. **Только получателю аванса** (`item.recipient`), кассиру/совету ничего; ORG-получатели пропускаются.

- Троттлинг «раз в неделю» — через идемпотентность Центра уведомлений: поле `period` (ISO-неделя) в payload делает его стабильным внутри недели, повторные тики гасятся, на новой неделе уходит ровно одно письмо. Своя таблица состояния не нужна.
- Точка отсчёта грейса — `proposal.updated_at` (для `PAID`-не-`REPORTED` item-а это фактически момент выплаты), фолбэк `created_at`.
- Конфиг (env, с дефолтами): `EXPENSE_ADVANCE_REMINDER_INTERVAL_MS` (тик, дефолт 6 ч), `EXPENSE_ADVANCE_REMINDER_GRACE_DAYS` (дней до первого напоминания, дефолт 3).
- **Follow-up (не сделано намеренно):** `deadline` из формы создания СЗ сейчас не доезжает до контракта (живёт только в подписанном документе). Для строгой семантики «просрочен по сроку из заявления» нужен апгрейд: аргумент `deadline` в `createexp` → поле в on-chain `proposals` → проекция парсера; тогда грейс заменяется сравнением с фактическим сроком.

## Скоуп расширения

Desktop UI для **шасси системы расходов** (MVP-SINGLE) Цифрового Кооператива. Расширение наполняет 7 страниц + 1 dialog по [issue C28-32](../../../../_blago/.../C28-32...md).

## Структура страниц

| Маршрут | Компонент | Назначение | Аудитория |
|---|---|---|---|
| `/:coopname/expenses` | `ExpensesRegistryPage` | Глобальный реестр расходов с фильтрами | все |
| `/:coopname/expenses/:hash` | `ExpenseDetailPage` | Экран доказательств: document2 + expense_files + ledger2 timeline | все |
| `/:coopname/expenses/admin/approve` | `ExpensesAdminApprovePage` | Очередь «Ждут одобрения председателя» | председатель |
| `/:coopname/expenses/admin/authorize` | `ExpensesAdminAuthorizePage` | Очередь «На авторизацию совета» | председатель |
| `/:coopname/expenses/cashier` | `CashierPage` | 4 таба кассира (готово к оплате / ждут отчёта / ждут утверждения / закрыто) | председатель |
| `/:coopname/expenses/my/advances` | `MyAdvancesPage` | Мои авансы — приложить чек (каркас, пока не выведен) | пайщик |
| dialog (без маршрута) | `ExpenseProposalCreateDialog` | Форма-конструктор СЗ с массивом items | все |

## Зависимости (порядок сборки)

1. **C28-28** — P0 ledger2 коды (БЛОКИРУЕТ контракт).
2. **C28-29** — контракт `expenses` + cooptypes types.
3. **C28-30** — ✅ document2 2010/2011 (готово).
4. **C28-31** — backend extension `expenses` + GraphQL → SDK Zeus generation.
5. **C28-32** (этот модуль) — UI scaffold готов, страницы-stub; **дозаливка содержимого после C28-31**.
6. **C28-33** — интеграция Благороста.
7. **C28-34** — e2e Cypress.

## Регистрация в `extensions-registry`

Зарегистрировано в `src/processes/init-installed-extensions/extensions-registry.ts` (ключ `expenses`). Помимо собственного воркспейса, расширение отдаёт страницу `ExpensesRegistryPage` (реестр всех расходов кооператива) — её монтирует стол совета как «Реестр расходов» (`extensions/soviet/install.ts`, маршрут `soviet-expenses-registry`). Страница пулов `ExpenseWalletsPage` остаётся в barrel'е, но на столах больше не монтируется (источник пулов — реестр `expense-wallets` для резолва имени кошелька).

## Канон вёрстки (`/home/admin/.claude/skills/mono-desktop-canon/`)

Каждая страница строится **строго** из `shared/ui/{base,domain,layout}`:

- **base:** `BaseTable`, `BaseChip`/`BaseBadge`, `BaseBanner`/`.banner--info`, `BaseDialog`, `BaseInput`, `BaseSelect`, `BaseForm`, `BaseButton`, `BaseCard`, `EmptyState`, `TableSkeleton`.
- **domain:** `<DocumentRow>`, `<DocumentSignatures>`, `<DataRow>`, `<VerticalStepper>`, `<AmountInput>`, `<FileUploader>`, `<RequisitesPicker>` (новый, под C28-32 — TBA в `shared/ui/domain/RequisitesPicker/`).
- **layout:** `<PageHead>`, `<PageTabs>`, `<AppDrawer>`.

Иконки **только Material** `q-icon`: `receipt_long`, `payments`, `construction`, `gavel`, `upload_file`. FontAwesome (`fa-*`) запрещён (отличие от capital/reports extensions, где FA — legacy).

Spacing/радиусы/цвета — токены `--p-*` и utility (`bg-primary`/`text-positive`). Никаких hex/inline px.

## Структура файлов

```
extensions/expenses/
├── README.md                                    ← этот файл
├── install.ts                                   ← IWorkspaceConfig (routes + meta)
├── index.ts                                     ← экспорты для extensions-registry
└── pages/
    ├── index.ts
    ├── ExpensesRegistryPage.vue                 ← /expenses
    ├── ExpenseDetailPage.vue                    ← /expenses/:hash
    ├── ExpensesAdminApprovePage.vue             ← /expenses/admin/approve
    ├── ExpensesAdminAuthorizePage.vue           ← /expenses/admin/authorize
    ├── CashierPage.vue                          ← /expenses/cashier
    ├── MyAdvancesPage.vue                       ← /expenses/my/advances (каркас)
    └── ExpenseProposalCreateDialog.vue          ← dialog (вызывается из ExpensesRegistryPage)
```

Дальше внутри каждой страницы — стандартная FSD-структура (`api/`, `model/`, `ui/`), но **до C28-31 запрещено** добавлять `api/index.ts` с raw GraphQL — канон monorepo (`mono-ai-2/CLAUDE.md`, секция «Никаких raw GraphQL-строк в desktop»).

## GraphQL-зависимости (из C28-31)

UI-страницы будут потреблять (через SDK Zeus, после C28-31):

```ts
import { Queries, Mutations } from '@coopenomics/sdk';

// Реестр + детали
Queries.Expenses.ExpenseProposals.query    // /expenses
Queries.Expenses.ExpenseProposalDetails.query  // /expenses/:hash
Queries.Expenses.ExpenseFiles.query

// Кассир + админ
Mutations.Expenses.PayExpenseItem.mutation
Mutations.Expenses.SubmitExpenseReport.mutation
// Авторизация/отклонение СЗ — решение совета (повестка), мутаций нет
Mutations.Expenses.ReturnExpenseItem.mutation
Mutations.Expenses.UploadExpenseFile.mutation

// Создание (через capital extension, не expenses!)
Mutations.Capital.CreateProgramExpenseProposal.mutation
```

## Когда расшивается C28-31

Каждая страница-stub расшивается по списку:

1. **`ExpensesRegistryPage`** — `BaseTable` с фильтр-баром `<FilterBar>`, polling через `useDataPoller(POLL_INTERVALS.MEDIUM)`, статусы через `<BaseBadge variant>`, низ — `.table-foot` с «Загрузить ещё».
2. **`ExpenseDetailPage`** — `<PageHead>` + статус-чип, секции: проект-карточка → item-table → цепочка артефактов (`<DocumentRow>` 2010/2011 + `<FileUploader>`-показ файлов) → `<VerticalStepper>` lifecycle.
3. **`ExpensesAdminApprovePage`** / **`ExpensesAdminAuthorizePage`** — canon-таблицы со столбцом действий (одобрить/отклонить/авторизовать/декланировать). Decline-модалка: `<BaseDialog>` с `<BaseInput textarea>` для reason.
4. **`CashierPage`** — `<PageTabs>` с 4 вкладками; каждая = `BaseTable`. Действие «Оплатил, приложить чек» = `<BaseDialog>` с `<FileUploader>` (multipart → MinIO через `Mutations.Expenses.UploadExpenseFile` → следом `Mutations.Expenses.PayExpenseItem`).
5. **`MyAdvancesPage`** — КАРКАС будущего стола кассира (роут `expenses-my-advances`), пока НЕ выведен в меню и ничего на него не ведёт. До сборки стола кассира авансы пайщика-получателя видны на его личной странице «Платежи» (`/:coopname/user/payments`, `ListOfPaymentsWidget`): строки авансов с панелью `ReportExpenseAdvancePanel` (приложить чек / отчитаться). Рабочие ссылки (напоминатель об авансах) ведут туда, а не на эту страницу.
6. **`ExpenseProposalCreateDialog`** — `<BaseDialog>` + `<BaseForm>` с массивом items, добавление/удаление item'ов через `<BaseButton>`. Per-item — `<BaseRadioCard>` для recipient_type {SELF/MEMBER/ORG}, `<BaseSelect>` для mechanics {ADVANCE/DIRECT}, `<AmountInput>` для сумм, `<RequisitesPicker>` (новый компонент в `shared/ui/domain/`) для ADVANCE-получателя.

## Ссылки

- PRD шасси: `13-platforma-tsifrovogo-kooperativa/components/14-versiya-3/requirements/f8-prd-shassi-sistemy-raskhodov-tsifrovogo-kooperativa-v12.md`
- Issue C28-32: `13-platforma-tsifrovogo-kooperativa/components/14-versiya-3/issues/C28-32-shassi-raskhodov-epik-4-ui-shassi-canon-mono-platform-v2.md`
- Канон вёрстки: `/home/admin/.claude/skills/mono-desktop-canon/` + `src/pages/_dev/ui/index.vue`
- HTML SoT: `/home/admin/blago/production/shared/MONO Design System.html`
- Backend плейн: `components/controller/src/extensions/expenses/README.md` (C28-31)
- Document2 templates: 2010 ExpenseProposalStatement, 2011 ExpenseProposalDecision (C28-30 ✅)
