# LEDGER_PLAN.md — План миграции на двойную запись

## 1. Текущее состояние (одинарная запись)

### Структура счёта (laccount)
```
id | name | available | blocked | writeoff
```
- `available` — доступные средства
- `blocked` — заблокированные средства
- `writeoff` — списанные средства

### Текущие операции
| Операция | Что делает |
|----------|-----------|
| `add(account_id, amount)` | `available += amount` |
| `sub(account_id, amount)` | `available -= amount` |
| `block(account_id, amount)` | `available -= amount, blocked += amount` |
| `unblock(account_id, amount)` | `blocked -= amount, available += amount` |
| `writeoff(account_id, amount)` | `available -= amount, writeoff += amount` |
| `writeoffcnsl(account_id, amount)` | `writeoff -= amount, available += amount` |
| `transfer(from, to, amount)` | `add(from) + sub(to)` — СЕМАНТИЧЕСКИ НЕВЕРНО! |

### Проблемы
1. **Нет двойной записи** — каждая операция затрагивает один счёт
2. **`blocked` на бухгалтерских счетах** — избыточно, блокировка только на кошельках
3. **`writeoff` как отдельное поле** — можно заменить проводкой на счёт расходов
4. **Избыточные методы**: `add_membership_fee`, `sub_membership_fee`, `block_membership_fee` — это просто add/sub/block с конкретным account_id
5. **`transfer` неверно**: add на `from` и sub на `to` (перевёрнуто)

---

## 2. Все вызовы Ledger из контрактов

### registrator (confirmreg, adduser)
| Операция | Дебет | Кредит | Сумма | Когда |
|----------|-------|--------|-------|-------|
| Паевой взнос при регистрации | 51 (Банк) | 80 (Паевой фонд) | minimum | confirmreg/adduser |
| Вступительный взнос | 51 (Банк) | 86.1 (Вступительные) | initial | confirmreg/adduser |

### wallet (deposit, withdraw)
| Операция | Дебет | Кредит | Сумма | Когда |
|----------|-------|--------|-------|-------|
| Пополнение кошелька | 51 (Банк) | 80 (Паевой фонд) | quantity | completedpst |
| Вывод из кошелька | 80 (Паевой фонд) | 51 (Банк) | quantity | completewthd |

### marketplace (supplcnf, receivecnf)
| Операция | Дебет | Кредит | Сумма | Когда |
|----------|-------|--------|-------|-------|
| Подтверждение поставки | 51 (Банк) | 80 (Паевой фонд) | total_cost | supplcnf |
| Подтверждение получения | 80 (Паевой фонд) | 51 (Банк) | base_cost | receivecnf |

### soviet (converttoaxn)
| Операция | Дебет | Кредит | Сумма | Когда |
|----------|-------|--------|-------|-------|
| Конвертация в AXON | 80 (Паевой фонд) | 86.7 (Делегатские) | amount | converttoaxn |

### capital
| Операция | Дебет | Кредит | Сумма | Когда |
|----------|-------|--------|-------|-------|
| Имущественный взнос | — | 80 (Паевой фонд) | amount | act2pgprp |
| Долг | — | 67 (Долгоср. займы) | amount | debtpaycnfrm |
| Результат | — | 80 (Паевой фонд) | amount | signact2 |
| Погашение долга | 67 (Долгоср. займы) | — | amount | signact2 |
| Импорт участника | — | 80 (Паевой фонд) | amount | importcontr |

---

## 3. Новая система (двойная запись)

### Новая структура счёта (laccount_v2)
```
id | name | account_type | debit_balance | credit_balance
```
- `account_type`: `active` (А), `passive` (П), `active_passive` (АП)
- `debit_balance` — дебетовый оборот
- `credit_balance` — кредитовый оборот

Активный счёт: сальдо = debit - credit (растёт по дебету)
Пассивный счёт: сальдо = credit - debit (растёт по кредиту)

### Классификация счетов

| Счёт | Код | Тип | Описание |
|------|-----|-----|----------|
| Основные средства | 01 | А | Имущество |
| Касса | 50 | А | Наличные |
| **Расчётный счёт** | **51** | **А** | Денежные средства в банке |
| Расчёты по займам | 58.3 | А | Выданные займы |
| Резервы | 63 | П | Резервы |
| Расчёты по налогам | 68 | П | Обязательства |
| Зарплата | 70 | П | Обязательства |
| Расчёты с пайщиками | 75 | АП | Дебиторка/кредиторка |
| **Паевой фонд** | **80** | **П** | Собственный капитал |
| Добавочный капитал | 83 | П | Капитал |
| **Целевые поступления** | **86** | **П** | Фонды кооператива |
| Прочие доходы/расходы | 91 | АП | Финансовый результат |

### Новый единый action: `posting`

```cpp
void ledger::posting(
  name coopname,
  name op_type,        // тип операции (имя из namespace)
  uint64_t debit_id,   // счёт дебета
  uint64_t credit_id,  // счёт кредита
  asset amount,
  string comment,
  checksum256 hash,
  name username
);
```

`op_type` — семантический тип операции:

| op_type | Дебет | Кредит | Описание |
|---------|-------|--------|----------|
| `regshare` | 51 | 80 | Паевой взнос при регистрации |
| `regentry` | 51 | 86.1 | Вступительный взнос |
| `deposit` | 51 | 80 | Пополнение кошелька |
| `withdraw` | 80 | 51 | Вывод из кошелька |
| `supplcnf` | 51 | 80 | Поставка подтверждена |
| `receivecnf` | 80 | 51 | Получение подтверждено |
| `convertaxn` | 80 | 86.7 | Конвертация в AXON |
| `propcontrib` | 10 | 80 | Имущественный взнос |
| `debtpay` | 51 | 67 | Погашение долга |
| `resultadd` | — | 80 | Начисление результата |
| `spreadadd` | 86 | 86.x | Распределение по фондам |
| `writeoff` | 91 | XX | Списание на расходы |

### Убираемые операции
- ❌ `block` / `unblock` — блокировка только на кошельках (wallet контракт)
- ❌ `writeoff` / `writeoffcnsl` как отдельные операции — заменяются проводкой на счёт 91
- ❌ `add_membership_fee` / `sub_membership_fee` / `block_membership_fee` / `unblock_membership_fee` — заменяются `posting`
- ❌ `transfer` — заменяется `posting`

### Новая таблица проводок (postings)
```
id | coopname | op_type | debit_id | credit_id | amount | comment | hash | username | created_at
```

---

## 4. План миграции

### Этап 1: Новые таблицы
- Создать `laccount_v2` с полями: `id, name, account_type, debit_balance, credit_balance`
- Создать `postings` для журнала проводок
- Инициализировать счета из ACCOUNT_MAP с указанием типа (А/П/АП)

### Этап 2: Action `posting`
- Один action вместо 8 (`add`, `sub`, `block`, `unblock`, `writeoff`, `writeoffcnsl`, `transfer`, `create`)
- Валидация: `debit_id != credit_id`, оба счёта существуют, amount > 0
- Обновление балансов:
  - `debit_account.debit_balance += amount`
  - `credit_account.credit_balance += amount`
- Запись в journal `postings`

### Этап 3: Миграция данных (в `migrate` action)
```
Для каждого laccount:
  1. Создать laccount_v2 с тем же id
  2. debit_balance = available (для активных) или 0 (для пассивных)
  3. credit_balance = 0 (для активных) или available (для пассивных)
  4. Игнорировать blocked (переносится в wallet)
```

### Этап 4: Обновление вызывающих контрактов
Заменить во всех контрактах:
```cpp
// БЫЛО:
Ledger::add(actor, coopname, 80, amount, memo, hash, username);
Ledger::add(actor, coopname, 51, amount, memo, hash, username);

// СТАЛО:
Ledger::posting(actor, coopname, "deposit"_n, 51, 80, amount, memo, hash, username);
```

### Этап 5: Бэкенд (controller)
- Обновить парсер: слушать `action::ledger::posting` вместо `add`/`sub`
- Обновить `LedgerInteractor`: работать с `debit_balance`/`credit_balance`
- Обновить `ChartOfAccountsEntity`: добавить `account_type`
- Обновить DTO: `available` → `saldo` (debit - credit или credit - debit)

### Этап 6: Фронтенд (desktop)
- Обновить страницу реестра счетов: показать дебет/кредит/сальдо
- Обновить историю: показать проводки с двумя счетами
- Обновить отчёты ФНС: использовать новые балансы

---

## 5. Зависимости и риски

| Контракт | Вызовы Ledger | Изменений |
|----------|--------------|-----------|
| registrator | 4 (add) | 2 posting |
| wallet | 4 (add, sub) | 2 posting |
| marketplace | 2 (add, sub) | 2 posting |
| soviet | 2 (sub, add) | 1 posting |
| capital | 4 (add, sub) | 3 posting |
| ledger (writeoff) | 1 (block) | Переделать |

**Риск**: Все контракты используют `Ledger::add/sub` через inline actions. Миграция требует обновления ВСЕХ контрактов одновременно.

**Митигация**: `migrate` action выполняется атомарно, после чего старые методы отключаются.
