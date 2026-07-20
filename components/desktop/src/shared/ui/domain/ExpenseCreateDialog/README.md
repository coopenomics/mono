# UI-виджеты шасси расходов

Общие компоненты для любого стола, подключающего шасси расходов (контракт
`expense`): Благорост — первый потребитель, стол кооперативного участка —
следующий. Полный рецепт подключения нового пула (контракт + backend + стол
совета) — `extensions/expenses/README.md`.

## Состав

| Что | Где | Зачем |
|---|---|---|
| `ExpenseCreateDialog` | `shared/ui/domain/ExpenseCreateDialog` | Создание СЗ: форма с позициями, черновик в localStorage, валидация, генерация и подпись заявления (document2 type=2010) |
| `ExpenseProposalList` | `shared/ui/domain/ExpenseProposalList` | Список СЗ пула карточками (статус, сумма, №, инициатор) |
| Подписи статусов | `src/shared/lib/expenses` | `proposalStatusLabel/Variant`, `itemStatusLabel/Variant`, `mechanicsLabel`, `fileKindLabel`, `shortExpenseId` |
| Реестр пулов | `src/shared/lib/expense-wallets` | `registerExpenseWallet(...)` из install.ts расширения → страница «Расходы» стола совета |

## ExpenseCreateDialog

Виджет владеет всем процессом до чейна; на чейн подаёт потребитель через проп
`submit` — у каждого пула своя мутация (capital → `createProgramExpense`,
у КУ будет своя).

```pug
ExpenseCreateDialog(
  v-model='createOpen',
  title='Создание расхода КУ',
  source-wallet='w.mkt.kuexp',                //- ledger2-пул, фиксируется в тексте СЗ
  draft-key='mp:market:create-expense:draft', //- свой ключ черновика
  :submit='submitToChain',                    //- (payload: ExpenseCreatePayload) => Promise
  @created='refresh'
)
```

`ExpenseCreatePayload` (см. `ExpenseCreateDialog.types.ts`): `expense_hash`,
`description`, `deadline` (`YYYY-MM-DD`), `items` (готовые для
`expense::createexp`, с `payment_method_id`/`requisites`), `statement`
(подписанный документ). Эталон обвязки — тонкая обёртка capital:
`extensions/capital/features/ProgramExpense/CreateProgramExpense/`.

## ExpenseProposalList

Презентационный: страница сама грузит СЗ своим запросом и отдаёт строки.

```pug
ExpenseProposalList(
  :rows='listRows',      //- ExpenseProposalListRow[]: expense_hash, title, status, total_planned, creator_name?, created_at?
  :loading='loading',
  @open='openExpense'    //- проваливание в детальную страницу расхода
)
```

Эталон сборки страницы (виджеты + WalletCard пулов + кнопка пополнения) —
`extensions/capital/pages/ProgramExpensesPage`. Эталон детальной страницы
(позиции, реквизиты, файлы, история состояний, кнопка «Закрыть расход») —
`extensions/capital/pages/ProgramExpensePage`.
