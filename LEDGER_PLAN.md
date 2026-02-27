# LEDGER_PLAN.md — План миграции на двойную запись

## 1. Текущее состояние (одинарная запись)

### Структура счёта (laccount)
```
id | name | available | blocked | writeoff
```

### Текущие операции
| Операция | Что делает |
|----------|-----------|
| `add(account_id, amount)` | `available += amount` |
| `sub(account_id, amount)` | `available -= amount` |
| `block(account_id, amount)` | `available -= amount, blocked += amount` |
| `unblock(account_id, amount)` | `blocked -= amount, available += amount` |
| `writeoff/writeoffcnsl` | Списание/отмена |

### Проблемы
1. Нет двойной записи — каждая операция затрагивает один счёт
2. `blocked` на бухгалтерских счетах — избыточно
3. Номера счетов жёстко прошиты в каждом контракте (51, 80, 86...)
4. INT id с преобразованием 861→86.1 на фронтенде — ограничения

---

## 2. Принципы новой системы

### Принцип 1: Номера счетов НЕ в контрактах

Контракты **не знают** номера счетов. Они знают только **тип операции** (op_type). Маппинг `op_type → (debit_account, credit_account)` хранится в одном месте — `shared_ledger.hpp`. При смене плана счетов (Россия → Беларусь) — меняется только маппинг.

### Принцип 2: Строковые ID счетов

Счета идентифицируются строками, не числами: `"51"`, `"80"`, `"86.1"`, `"86.2"`. Это снимает ограничение на int→float преобразование.

### Принцип 3: Всегда двойная запись

Каждая операция — это `debit` + `credit`. Одинарных записей нет. `block`/`unblock` на счетах — убирается.

---

## 3. Архитектура

### shared_ledger.hpp — единый файл маппинга

```cpp
namespace Ledger {
  // План счетов (меняется при смене юрисдикции)
  namespace chart {
    static constexpr const char* BANK_ACCOUNT = "51";
    static constexpr const char* SHARE_FUND = "80";
    static constexpr const char* ENTRANCE_FEES = "86.1";
    static constexpr const char* RESERVE_FUND = "86.2";
    static constexpr const char* TARGET_RECEIPTS = "86";
    static constexpr const char* LONG_TERM_LOANS = "67";
    static constexpr const char* MATERIALS = "10";
    static constexpr const char* DELEGATE_FEES = "86.7";
    static constexpr const char* EXPENSES = "91";
    // ... остальные
  }

  // Тип счёта
  enum class AccountType { ACTIVE, PASSIVE, ACTIVE_PASSIVE };

  // Реестр проводок — ЕДИНСТВЕННОЕ МЕСТО маппинга
  struct PostingDef {
    const char* debit;
    const char* credit;
  };

  // Все типы проводок и их маппинг на счета
  static const std::map<eosio::name, PostingDef> POSTING_MAP = {
    {"regshare"_n,   {chart::BANK_ACCOUNT, chart::SHARE_FUND}},
    {"regentry"_n,   {chart::BANK_ACCOUNT, chart::ENTRANCE_FEES}},
    {"deposit"_n,    {chart::BANK_ACCOUNT, chart::SHARE_FUND}},
    {"withdraw"_n,   {chart::SHARE_FUND,   chart::BANK_ACCOUNT}},
    {"supplcnf"_n,   {chart::BANK_ACCOUNT, chart::SHARE_FUND}},
    {"receivecnf"_n, {chart::SHARE_FUND,   chart::BANK_ACCOUNT}},
    {"convertaxn"_n, {chart::SHARE_FUND,   chart::DELEGATE_FEES}},
    {"propcontrib"_n,{chart::MATERIALS,     chart::SHARE_FUND}},
    {"debtpay"_n,    {chart::BANK_ACCOUNT, chart::LONG_TERM_LOANS}},
    {"debtclose"_n,  {chart::LONG_TERM_LOANS, chart::BANK_ACCOUNT}},
    {"spreadadd"_n,  {chart::TARGET_RECEIPTS, chart::TARGET_RECEIPTS}}, // внутренний
    {"writeoff"_n,   {chart::EXPENSES,     ""}},  // второй счёт указывается при вызове
  };

  // Единый вызов из любого контракта
  static void posting(
    eosio::name actor,
    eosio::name coopname,
    eosio::name op_type,
    eosio::asset amount,
    std::string comment,
    checksum256 hash,
    eosio::name username
  );
}
```

### Вызов из контрактов

```cpp
// БЫЛО (registrator/confirmreg.cpp):
Ledger::add(_registrator, coopname, Ledger::accounts::SHARE_FUND, amount, memo, hash, username);
Ledger::add(_registrator, coopname, Ledger::accounts::BANK_ACCOUNT, amount, memo, hash, username);

// СТАЛО:
Ledger::posting(_registrator, coopname, "regshare"_n, amount, memo, hash, username);
```

Один вызов вместо двух. Номера счетов в контракте НЕ фигурируют.

---

## 4. Новые таблицы блокчейна

### laccount_v2 (scope: coopname)
```
id (string) | name | account_type | debit_total | credit_total
```
- `id` — строка: "51", "80", "86.1", "86.2"
- `account_type` — active/passive/active_passive
- `debit_total` — сумма всех дебетов
- `credit_total` — сумма всех кредитов
- Сальдо: для А = debit - credit, для П = credit - debit

### journal (scope: coopname)
```
id | op_type | debit_id | credit_id | amount | comment | hash | username | created_at
```

---

## 5. Все проводки по контрактам

### registrator
| op_type | Дебет | Кредит | Когда |
|---------|-------|--------|-------|
| `regshare` | 51 (Банк) | 80 (Паевой фонд) | confirmreg, adduser |
| `regentry` | 51 (Банк) | 86.1 (Вступительные) | confirmreg, adduser |

### wallet
| op_type | Дебет | Кредит | Когда |
|---------|-------|--------|-------|
| `deposit` | 51 (Банк) | 80 (Паевой фонд) | completedpst |
| `withdraw` | 80 (Паевой фонд) | 51 (Банк) | completewthd |

### marketplace
| op_type | Дебет | Кредит | Когда |
|---------|-------|--------|-------|
| `supplcnf` | 51 (Банк) | 80 (Паевой фонд) | supplcnf |
| `receivecnf` | 80 (Паевой фонд) | 51 (Банк) | receivecnf |

### soviet
| op_type | Дебет | Кредит | Когда |
|---------|-------|--------|-------|
| `convertaxn` | 80 (Паевой фонд) | 86.7 (Делегатские) | converttoaxn |

### capital
| op_type | Дебет | Кредит | Когда |
|---------|-------|--------|-------|
| `propcontrib` | 10 (Материалы) | 80 (Паевой фонд) | act2pgprp |
| `debtpay` | 51 (Банк) | 67 (Долгоср. займы) | debtpaycnfrm |
| `debtclose` | 67 (Долгоср. займы) | 80 (Паевой фонд) | signact2 |
| `resultadd` | 51 (Банк) | 80 (Паевой фонд) | signact2 |
| `importcontr` | 51 (Банк) | 80 (Паевой фонд) | importcontr |

---

## 6. Убираемый функционал

- ❌ `block()` / `unblock()` — блокировка только в wallet контракте
- ❌ `writeoff()` / `writeoffcnsl()` как отдельные — заменяются проводкой
- ❌ `add_membership_fee()` / `sub_membership_fee()` / `block_membership_fee()` / `unblock_membership_fee()` — всё через `posting`
- ❌ `transfer()` — заменяется `posting`
- ❌ Числовые ID счетов в вызовах — только op_type

---

## 7. Этапы реализации

### Этап 1: shared_ledger.hpp v2
- Новый namespace `Ledger::chart` со строковыми ID
- `POSTING_MAP` — маппинг op_type → (debit, credit)
- Функция `posting()` — единый action
- `AccountType` enum

### Этап 2: ledger контракт v2
- Новые таблицы `laccount_v2` и `journal`
- Action `posting` — проверяет op_type в POSTING_MAP, обновляет оба счёта, пишет в journal
- Action `init_v2` — создаёт счета из ACCOUNT_MAP с account_type

### Этап 3: migrate action
- Читает все laccount → создаёт laccount_v2 с debit_total/credit_total
- Для активных: debit_total = available
- Для пассивных: credit_total = available
- Игнорирует blocked (убирается)

### Этап 4: Обновление контрактов
- registrator: 2 вызова → 2 posting
- wallet: 4 вызова → 2 posting
- marketplace: 2 вызова → 2 posting
- soviet: 2 вызова → 1 posting
- capital: 5 вызовов → 4 posting

### Этап 5: Бэкенд
- Parser: слушать `action::ledger::posting`
- LedgerInteractor: debit_total/credit_total → saldo
- ChartOfAccountsEntity: строковые ID + account_type
- API: getJournal query для истории проводок

### Этап 6: Фронтенд
- Реестр счетов: строковые ID, дебет/кредит/сальдо
- История: журнал проводок (op_type, дебет→кредит, сумма)
- Убрать int→float преобразование ID

---

## 8. Смена юрисдикции

Для перехода РФ → РБ:
1. Изменить `Ledger::chart` — новые номера счетов
2. Обновить `POSTING_MAP` если нужны другие счета
3. Запустить `init_v2` с новым планом
4. **Контракты НЕ меняются** — они знают только op_type
