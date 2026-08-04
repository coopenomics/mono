# C28-28 · Naming Proposal v3 — универсальное шасси расхода

**Изменения v3 (2026-06-02, второй раунд голосового):** (1) контракт `expense` ничего не знает про `capital` — callback на финализацию устанавливается при создании СЗ как **переменная** (`callback_contract` + `callback_action` + опц. `callback_data`), хардкод запрещён; (2) проводка расхода для ОБЕИХ механик Благороста — **Дт 08 / Кт 51** (не 80) — паевой фонд при расходе не трогается, меняется только форма актива 51 → 08; (3) `o.exp.advrpt` без бухпроводки — она уже сделана при выдаче (canal 08/51 второй раз не строим); (4) document2 — только 2010/2011, 2012/2013/2014 = файлы MinIO.

**Изменения v2 (первый раунд):** контракт делается универсальным — не вводим новых счетов (60/71 отвергнуты), используем существующие 04/08/51/58/80/86; источник средств и operation_code передаются **извне** в payload, контракт ничего не «знает» про Благорост или хозрасходы; матрица 5 операций (вместо 6).

**Канон:** `feedback_kanon_naming_soglasovyvat` — имена в ontology согласовываются ДО реализации; прецедент 2026-05-19.

**Источник правды:** `components/contracts/cpp/lib/core/ledger2/{accounts,wallets,operations}.hpp` mono-ai-2 (`feat/expense-chassis-mvp`).

---

## 0. Что изменилось v1 → v2

| Точка | v1 | v2 | Причина |
|---|---|---|---|
| Имя контракта | `expenses` (мн.ч.) | **`expense`** (ед.ч.) | пользователь §1 |
| Счета 60/71 | новые account_id | **не вводим** | пользователь §2 — план счетов фиксирован 04/08/51/58/80/86 |
| Кошелёк `w.exp.sup` | COOPERATIVE для расчётов с поставщиком | **отменён** | `w.mkt.payout` занят, `w.exp.sup` дублирует семантику без выгоды |
| Operation codes | 6 в реестре с хардкод-источниками | **5**, по матрице source × mechanic; источник определяется при выборе кода | универсальность шасси, расширение без правки контракта |
| `o.exp.compen` (12 char) | основной | **`o.exp.over`** | пользователь §7.1 — короче, понятнее |
| capwip-флаг | отдельная политика | **payload-флаг `wip_project_hash`** | пользователь §5 — capital trigger только если payload содержит project_hash |
| Расширение реестра | ADD COLUMN | реестр расширяемый — каждая новая пара (source, mechanic) = новая `o.exp.*` запись | хардкод-only constraint OPERATION_REGISTRY |

---

## 1. Контракт-владелец

`expense` (ед.ч.). Префиксы:
- `[[eosio::action]]`: `expense::createexp`, `submitexp`, `authexp`, `payexp`, `reportexp`, `closeexp`, `declexp`, `returnexp`, `overspendexp`.
- Operation codes: `o.exp.*` (§3).
- Wallets: `w.exp.adv` (один — §4).
- Processes: `p.exp.expns`.

## 2. План счетов — без новых записей

Существующие из `accounts.hpp`:
- **04** НМА (А) — если расход капитализируется в РИД
- **08** Вложения во внеоборотные активы (А) — WIP-проект РИД
- **51** Расчётный счёт (А)
- **58** Финансовые вложения (А) — займы
- **80** Паевой фонд (П)
- **86** Целевое финансирование (П) — членские, хозрасходы

**60/71 отвергнуты.** Подотчёт пайщика моделируется кошельком-резервом (`w.exp.adv` USER_SHARED) аналогично `w.wal.wpend` — без отдельного бух.счёта.

## 3. Operation codes — 5 в реестре, матрица source × mechanic

В `OPERATION_REGISTRY[]`:

| # | C++ константа | eosio::name | WalletOp | wallet_from → wallet_to | Dr / Cr | human_name |
|---|---|---|---|---|---|---|
| 3.1 | `operations::expense::BLAGO_ADVANCE` | `o.exp.blgadv` | TRANSFER | `PROGRAM_EXPENSE_POOL` → `w.exp.adv` | **08 / 51** | «Выдача подотчётных из пула расходов ЦПП «Благорост»» |
| 3.2 | `operations::expense::BLAGO_DIRECT` | `o.exp.blgdir` | BURN | `PROGRAM_EXPENSE_POOL` → ∅ | **08 / 51** | «Прямая оплата из пула расходов ЦПП «Благорост»» |
| 3.3 | `operations::expense::ADVANCE_REPORT` | `o.exp.advrpt` | BURN | `w.exp.adv` → ∅ | 0 / 0 | «Закрытие подотчёта пайщика по отчёту (canal 08/51 уже сделан на blgadv)» |
| 3.4 | `operations::expense::ADVANCE_RETURN` | `o.exp.advret` | TRANSFER | `w.exp.adv` → `PROGRAM_EXPENSE_POOL` | **51 / 08** | «Возврат неиспользованного подотчёта в пул расходов (зеркало blgadv)» |
| 3.5 | `operations::expense::OVERSPEND` | `o.exp.over` | TRANSFER | `PROGRAM_EXPENSE_POOL` → `w.exp.adv` | **08 / 51** | «Доплата сверх подотчёта (перерасход)» |

**Изменение v4 (2026-06-12, голосовое):** источник оплат — НЕ `w.cap.blago` (он USER_SHARED: списание уменьшало личный паевой кошелёк пайщика-инициатора — категорически неверно). Введён КООПЕРАТИВНЫЙ кошелёк `w.cap.pgexp` (`PROGRAM_EXPENSE_POOL`, «Пул программных расходов ЦПП «Благорост»»): пополняется `capital::topupprogexp` операцией `o.cap.pgtop` (ISSUE, без Dr/Cr — деньги физически на 51 со взносов, выделяется назначение), из него `expense::payexp` платит обе механики. `username` в ledger2-проводках шасси — получатель позиции (подотчёт `w.exp.adv` числится на получателе аванса), не автор СЗ.

**Изменение v5 (2026-06-12):** фабричная настройка пулов — в `ledger2/operations.hpp` введена таблица `EXPENSE_OPERATION_SETS` (`source_wallet → {advance, direct, report, refund, overspend}` с compile-time валидацией согласованности с `OPERATION_REGISTRY`). Контракт `expense` больше не содержит захардкоженных operation_code: коды всех пяти операций жизненного цикла выводятся из `proposal.source_wallet`. Подключение шасси к новому пулу (например, кошельку членских взносов КУ) = 5 операций в `OPERATION_REGISTRY` + 1 строка в `EXPENSE_OPERATION_SETS`, без правок expense. На фронте пулы регистрируются фабрично: `registerExpenseWallet(...)` из `install.ts` расширения → страница «Расходы» стола совета (`src/shared/lib/expense-wallets`). Общие UI-виджеты шасси — в `src/shared/ui/domain`: `ExpenseCreateDialog` (форма + черновик + генерация и подпись СЗ; подача на чейн — проп `submit`, который задаёт расширение-потребитель) и `ExpenseProposalList` (список СЗ пула, данные подаёт страница); подписи статусов — `src/shared/lib/expenses`. capital — первый потребитель (тонкие обёртки в `features/ProgramExpense`); стол КУ собирает свою страницу из тех же виджетов: `source-wallet` + `draft-key` + своя мутация подачи.

**Process_type:** один — `processes::expense::PROPOSAL = "p.exp.expns"_n`. Все 5 кодов привязаны к нему.

### Объяснение проводок

**Базовое состояние Благороста ДО расхода** (поднял `p.cap.invest.standard.yaml` и `operations.hpp`):

- Денежная инвестиция (`o.cap.invest`): TRANSFER `w.wal.share` → `w.cap.blago`, **без бухпроводки** (оба счёт 80). Деньги физически на 51 с момента изначального `o.wal.depcpl` (Dr 51 / Cr 80).
- РИД-имущество (`o.cap.import`/`actprp`): Dr 04 / Cr 80, наполняет НМА.
- **08 пустой** на момент инвестиции деньгами — никто туда ничего не клал.

**Принцип расхода:** деньги физически уходят с 51 → Cr 51. Появляется WIP-стоимость проекта → Dr 08. Паевой фонд (80) **не меняется** — это бух-инвариант (форма актива переходит 51 → 08, ценность остаётся в фонде).

- **3.1 BLAGO_ADVANCE (Дт 08 / Кт 51):** деньги физически уходят пайщику (Cr 51), стоимость капитализируется в WIP проекта (Dr 08). Кошелёк-резерв `w.exp.adv` фиксирует ответственность пайщика (USER_SHARED) до отчёта.
- **3.2 BLAGO_DIRECT (Дт 08 / Кт 51):** прямая оплата организации — Cr 51 как раз эта оплата, Dr 08 капитализирует стоимость. BURN `w.cap.blago` — резерв пула.
- **3.3 ADVANCE_REPORT (0/0):** проводка 08/51 **уже сделана** на blgadv. При отчёте — только BURN подотчётного кошелька. Никаких canal 08/51 второй раз.
- **3.4 ADVANCE_RETURN (Дт 51 / Кт 08):** деньги возвращаются на банк, WIP-стоимость уменьшается. Зеркало blgadv. Кошелёк-резерв TRANSFER обратно в `w.cap.blago`.
- **3.5 OVERSPEND (Дт 08 / Кт 51):** добавочная выдача после `OVERSPEND` сразу закрывается `o.exp.advrpt` — это две последовательные записи в `expense::overspendexp`.

### Расширяемость

Новый источник (хозрасходы из членских 86, фонд развития, AXN) — это **новая пара кодов** в реестре:

| Будущее | source | target | пример имени |
|---|---|---|---|
| Хозрасходы DIRECT | `w.sov.expns` (86) | банк | `o.exp.sovdir` (Dr 26\*/Cr 51 или прямой Dr 86/Cr 51) |
| Хозрасходы ADVANCE | `w.sov.expns` | пайщик-подотчёт | `o.exp.sovadv` |
| Фонд развития DIRECT | `w.sov.devfnd` (новый) | банк | `o.exp.devdir` |

Контракт `expense` не меняется — только реестр ledger2 расширяется. Сейчас в MVP — только Благорост (3.1–3.5).

\* Счёт 26 в плане отсутствует. Если когда-то понадобится — добавится отдельным эпиком; для MVP хозрасходов из членских делаем прямо Dr 86 / Cr 51 без транзита через 26.

## 4. Кошельки — один новый

```cpp
// w.exp.* — Шасси расходов (подотчёт пайщика)
static constexpr eosio::name ADVANCE_HOLD = "w.exp.adv"_n;   ///< Подотчётные средства у пайщика (USER_SHARED, резерв-pattern; зеркало w.wal.wpend)
```

`LEDGER2_WALLET_REGISTRY`:
- `ADVANCE_HOLD` — «Подотчётные средства пайщика» — **USER_SHARED** (разрез по пайщику-получателю; именно он держит ответственность за отчёт).

`w.exp.sup` (расчёты с поставщиком) **не заводим** — DIRECT обходится без транзитного кошелька.

`w.mkt.payout` **не трогаем** — занят `o.mkt.recv` (Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS).

## 5. Callback на финализацию — переменная при создании СЗ

Контракт `expense` **не знает** о `capital`. Никаких импортов `capital::*`, никакого хардкода имени action.

При создании СЗ (`expense::createexp`) в payload передаётся опциональный блок-callback:

```cpp
struct callback_handler {
    eosio::name   contract;   ///< кто слушает финализацию (например, "capital"_n)
    eosio::name   action;     ///< что вызвать (например, "onexpreport"_n)
    std::vector<char> data;   ///< опц. payload (например, packed wip_project_hash)
};
```

Поле хранится в таблице `expense.proposals` рядом с `proposal_hash`. При финализации (`expense::reportexp` или `closeexp`) контракт:

```cpp
if (proposal.callback.contract != name{}) {
  eosio::action::send_inline(
    proposal.callback.contract,
    proposal.callback.action,
    {{ self, "active"_n }},
    std::tuple(proposal_hash, amount, proposal.callback.data)
  );
}
```

`expense` дёргает callback **как переменную** — куда сказали при создании, туда и шлёт. Capital у себя сам распарсит `data` (там его `wip_project_hash`) и решит что делать.

**Никаких:**
- Хардкода имени `capital::onexpreport` в коде `expense`.
- Полей с capital-семантикой (`wip_project_hash`) в схеме `expense`.
- Условных веток «если source = Благорост, то...» — `expense` агностичен к источнику.

**Альтернативы (отвергнуты):**
- Флаг в payload reportexp — отказ: не масштабируется (один флаг на один контракт-слушатель).
- Event-bus с подписчиками — отказ: для on-chain контрактов EOSIO нет такого паттерна без отдельного event-router'а; перекладывает сложность вне scope MVP.
- Хардкод `capital::onexpreport` — отказ пользователем явно.

## 6. Универсальный поток

```
1. UI собирает СЗ. Выбор источника (UI dropdown → BLAGOROST_FUND / SOV_EXPENSES / ...).
2. UI определяет operation_code по матрице (source × mechanic):
     BLAGOROST_FUND + ADVANCE → o.exp.blgadv
     BLAGOROST_FUND + DIRECT  → o.exp.blgdir
     SOV_EXPENSES + DIRECT    → o.exp.sovdir (будущее)
3. expense::createexp(proposal_hash, items[], ?callback{contract, action, data})
     — для расходов в РИД-проект Благороста UI/backend заполняет callback = {"capital", "onexpreport", packed(wip_project_hash)}.
4. expense::payexp(proposal_hash, item_hash, operation_code, amount)
5. Контракт валидирует: operation_code ∈ OPERATION_REGISTRY, process_type == p.exp.expns.
6. Контракт зовёт ledger2::apply(operation_code, sum, from?, to?). Реестр сам подставляет правильные wallets и Dr/Cr.
7. Для ADVANCE — фронт пайщика прикладывает чек → expense::reportexp → o.exp.advrpt.
8. Для DIRECT — backend сразу после payexp вызывает reportexp (внутренне, без UI).
9. Если в proposal сохранён callback — после reportexp inline action на (callback.contract, callback.action, data).
```

Контракт `expense` агностичен:
- к **источнику** (передаётся operation_code, который сам несёт `wallet_from` в реестре);
- к **программе-получателю** (callback-handler — переменная);
- к **бухгалтерским счетам** (выводятся из реестра по operation_code).

## 7. Acceptance Criteria для C28-28 v3 — все ack получены

- [x] §1: контракт `expense` (ед.ч.). Ack 2026-06-02.
- [x] §2: 60/71 не вводим, существующие 04/08/51/58/80/86. Ack 2026-06-02.
- [x] §3 матрица: 5 op-кодов; обе механики Благороста Дт 08 / Кт 51 (не 08/80); хозрасходы (sov-источники) — отдельный эпик. Ack 2026-06-02.
- [x] §4 кошельки: один новый `w.exp.adv` USER_SHARED; `w.exp.sup` отменён; `w.mkt.payout` не трогаем. Ack 2026-06-02.
- [x] §5 callback: не payload-флаг, а **переменная** `callback{contract, action, data}` в `expense.proposals`, заполняется при createexp; `expense` ничего не знает про `capital`. Ack 2026-06-02 («если так тогда ок»).
- [x] §6: контракт универсальный, operation_code определяется фронтом/backend.
- [x] Document2: только 2010/2011; 2012/2013/2014 — файлы MinIO, не шаблоны. Ack 2026-06-02.

---

## 9. Roadmap после ack

1. C28-28 → C++:
   - `accounts.hpp` — без изменений
   - `wallets.hpp` — `+w.exp.adv`
   - `processes.hpp` — `+p.exp.expns`
   - `operations.hpp` — `+5 entries` в `OPERATION_REGISTRY[]` под namespace `operations::expense`
2. CI-тест `ledger2_actions_registry_test` — ожидать 5 новых кодов.
3. `pnpm -w build` cooptypes — auto-regen enum `OperationCode`.
4. C28-29 расшивается на ledger2-инструкции (имена операций ↔ имена C++ actions контракта).
5. C28-31 backend `expense` extension использует cooptypes enums.
