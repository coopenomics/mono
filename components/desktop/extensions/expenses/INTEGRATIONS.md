# Expenses · Integrations & Cleanup (C28-33)

**Статус:** doc-scaffold. Файл фиксирует план интеграции Благороста с шасси и cleanup legacy program-expense; реализация после закрытия [C28-29](../../../../_blago/.../C28-29.md), [C28-31](../../../../_blago/.../C28-31.md), [C28-32](../../../../_blago/.../C28-32.md).

## 1. Благорост как первый потребитель шасси

### Точка входа

- Расход из Благороста = СЗ с `source_wallet = BLAGOROST_POOL`.
- Создание идёт через **существующий** `capital::createprogexp` (никаких новых contract-actions; этот action уже из Эпика 1 Благороста).
- Действие `capital::createprogexp` валидирует:
  - `source_wallet` принадлежит пайщику-creator'у (chair / member-of-program);
  - на пуле достаточно остатка;
  - `BLAGOROST_POOL` зарегистрирован в `capital_programs`.

### Пополнение пула

Существующий `capital::topupprogexp` (вход в пул), не трогаем; **оставляем единственной обёрткой** из старой пачки `topupProgramExpense` в SDK.

### UI-вход для Благороста

`ExpenseProposalCreateDialog` (C28-32) принимает `?source=BLAGOROST_POOL` или эквивалентный prop. Селектор пула фильтруется по правам пайщика. Дальнейшие шаги (approve / authorize / pay / report) — общий канон шасси, без отдельных Благорост-страниц.

## 2. Каталог уведомлений (универсальный)

Заводим в Notification Center (C28-22..C28-27). События **универсальны** для всех потребителей шасси, не Благорост-специфичны.

| Event | Тип | Получатели |
|---|---|---|
| `exp.proposal.created` | action_required | председатель |
| `exp.proposal.approved` | action_required | совет |
|  | info | creator |
| `exp.proposal.authorized` | action_required | кассир |
|  | info | creator, члены совета |
| `exp.proposal.declined` | info | creator |
| `exp.item.paid` | action_required | получатель аванса (CTA «приложить чек») |
|  | info | creator |
| `exp.item.reported` | action_required | кассир |
| `exp.proposal.report.submitted` | action_required | совет |
| `exp.proposal.closed` | info | все участники |
| `exp.item.return` | info | все участники |

Источник публикации — backend `expenses` extension (C28-31) через NestJS EventEmitter2 → Notification Center.

## 3. Backward-compat роутов

| Старый маршрут | Действие | Новый маршрут |
|---|---|---|
| `/:coopname/programs/blagorost/expenses` | редирект (301-аналог в Vue Router) | `/:coopname/expenses?source=BLAGOROST_POOL` |
| `/:coopname/programs/blagorost/expenses/:id` | редирект по hash | `/:coopname/expenses/:hash` |
| `/:coopname/program-expenses/*` (из PR #59) | удалить (см. §4) | — |

Реализация — `routes.ts` расширения `capital`, `beforeEnter`-guard с `next({ name: 'expenses', query: { source: 'BLAGOROST_POOL' } })`.

## 4. Cleanup legacy program-expense

**Текущее состояние ветки `feat/expense-chassis-mvp` @ `6e0fb185b6a`:**

```bash
grep -rl "ProgramExpense\|program-expense\|programExpense" \
  components/desktop/src components/desktop/extensions \
  components/coopback/src components/cooptypes/src
# → пусто (нет ни одного файла)
```

PR #59 не залит в `dev`/`feat/expense-chassis-mvp`. Удалять нечего. При появлении (если merge произойдёт извне) — список таргетов:

### Desktop

- `extensions/capital/entities/ProgramExpense/`
- `extensions/capital/features/ProgramExpense/`
- `extensions/capital/widgets/ProgramExpenses/`
- `extensions/capital/pages/ProgramExpensesPage.vue`
- `extensions/capital/pages/ProgramExpenseDetailPage.vue`

### SDK

`components/sdk/src/mutations/capital/`:
- `createProgramExpense` — DELETE
- `approveProgramExpense` — DELETE
- `authorizeProgramExpense` — DELETE
- `confirmProgramExpense` — DELETE
- `declineProgramExpense` — DELETE
- `topupProgramExpense` — **KEEP** (вход в пул)

### Cooptypes

`components/cooptypes/src/contracts/capital/actions/`:
- `approveProgramExpense` — DELETE
- `authProgramExpense` — DELETE
- `createProgramExpense` — DELETE
- `declineProgramExpense` — DELETE
- `payProgramExpense` — DELETE
- `topupProgramExpense` — **KEEP**

После удаления — `pnpm -w build` cooptypes + sdk, коммит ZEUS-клиента (canon `feedback_codegen_build_commit`).

## 5. Шаблоны document2 1010/1011

**Состояние:** не существует.

```bash
find components -path '*document2*' \( -name '*1010*' -o -name '*1011*' \) 2>/dev/null
# → пусто
```

Их роль закрывают новые 2010/2011 (C28-30, ✅ commit `1fa41b2b39a`). Удалять нечего. Если найдутся в будущих merge — DELETE без миграции (legacy одиночные program-expense не выходили в прод).

## 6. Acceptance Criteria

- [ ] Из BLAGOROST_POOL делается полный путь create → approve → authorize → pay → report → close через UI (после C28-32 расшивки).
- [ ] Уведомления приходят правильным ролям (каталог §2).
- [ ] Старые роуты редиректят, новые работают (§3).
- [ ] Мёртвый код Благороста удалён (§4 — на момент написания: уже чисто).

## 7. Когда расшивается C28-33

1. Закрыть C28-29 (`capital::createprogexp` уже есть; добавить hook на `expenses::createexp` если source=BLAGOROST_POOL).
2. Закрыть C28-31 (backend `expenses` extension + EventEmitter события).
3. C28-32 расшивается до канон-страниц.
4. Подключить Notification Center handlers к 9 событиям (отдельные NotificationProducer в `coopback/src/extensions/expenses/notifications/`).
5. Добавить `beforeEnter`-guard в `extensions/capital/install.ts` для редиректов §3.
6. Финальный re-grep `ProgramExpense` — должен оставаться пустым.
