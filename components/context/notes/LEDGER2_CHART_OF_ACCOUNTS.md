# Ledger2: план счетов и реестр операций (пересмотр 2026-04-20)

Полный «как оно работает по факту» справочник для бухгалтеров и разработчиков.
Источник истины — `components/contracts/cpp/lib/core/ledger2/{accounts.hpp,actions.hpp,wallets.hpp}`.

## План счетов (6 счетов)

| Код | Constexpr id | Имя | Тип | Роль |
|----:|:---:|:---|:---:|:---|
| 04 | 4_000  | Нематериальные активы | ACTIVE | Принятые РИД (после accept РИД из 08) |
| 08 | 8_000  | Вложения во внеоборотные активы | ACTIVE | Принятый коммит имуществом в процессе (до accept) |
| 51 | 51_000 | Расчётный счёт | ACTIVE | Деньги на расчётном; нет wallet-зеркала |
| 58 | 58_000 | Финансовые вложения | ACTIVE | Выданные пайщикам беспроцентные займы |
| 80 | 80_000 | Паевой фонд (складочный капитал) | PASSIVE | Все паевые взносы |
| 86 | 86_000 | Целевое финансирование | PASSIVE | Вступительные + членские + делегатские |

**Удалены в пересмотре 2026-04-20:**
- **99 OPENING_TRANSIT** — транзит миграции (был лишним, теперь прямые проводки)
- **67 LONG_TERM_LOANS** — займы идут через 58 (активные фин. вложения кооператива в пайщика)

## Кошельки (17 wallets)

Кошельки — аналитические разрезы счетов. Группы по тысячам:
- **2xxx** — фонды на счёте 80 (паевой)
- **3xxx** — фонды на счёте 86 (целевое финансирование)
- **4xxx** — выплаты, обязательства, фин. вложения
- **5xxx** — служебные
- **9xxx** — ЦПП «Благорост»
- **10xxx** — ЦПП «Генератор»
- **11xxx** — ЦПП «Стол Заказов»

| id | Const | Имя | Связанный счёт |
|---:|:---|:---|:---|
| 2001 | SHARE_FUND_PAY | ЦПП «Цифровой Кошелёк» — паевые взносы деньгами | 80 |
| 2002 | MIN_SHARE_FUND | Минимальный паевой взнос | 80 |
| 2003 | SHARE_FUND_RID | Паевой фонд — принятые РИД | 80 (и 04 при приёме) |
| 3001 | ENTRANCE_FEES | Вступительные взносы | 86 |
| 3002 | MEMBERSHIP_FEES | Членские взносы (платформенные) | 86 |
| 3003 | DELEGATE_FEES | Делегатские членские взносы (цель CONVERT_TO_AXN) | 86 |
| 4001 | WITHDRAWALS_SINK | Возвраты паевых взносов | 80 (списание) |
| 4002 | SUPPLIER_PAYMENTS | Выплаты поставщикам | 80 (списание) |
| 4051 | LOAN_ISSUED | Выданные беспроцентные займы | 58 |
| 5001 | MANUAL_ADJUST | Ручные корректировки (резерв) | — |
| 9001 | BLAGOROST_INVEST | ЦПП «Благорост» — инвестиции деньгами | 80 |
| 9002 | BLAGOROST_RID | ЦПП «Благорост» — принятые РИД | 04/80 |
| 9003 | BLAGOROST_PROPERTY | ЦПП «Благорост» — имущественные взносы | 80 |
| 9004 | BLAGOROST_MEMBERSHIP | ЦПП «Благорост» — членские взносы | 86 |
| 10001 | GENERATOR_COMMIT | ЦПП «Генератор» — принятый коммит имущества | 08 |
| 10002 | GENERATOR_MEMBERSHIP | ЦПП «Генератор» — членские взносы | 86 |
| 11001 | MARKETPLACE_FUND | ЦПП «Стол Заказов» — общий кошелёк (резерв) | — |

**Удалены в пересмотре 2026-04-20:**
- **1001 CASH_MAIN** — зеркало 51; счёт 51 теперь ведётся только в `accounts2`
- **4050 LOAN_RECEIVED** / **4052 DEBT_CLOSED_SINK** — заменены на 4051 LOAN_ISSUED

## Типы операций (WalletOp)

| id | Тип | Поведение на wallets | Debit/Credit проводка |
|---:|:---|:---|:---|
| 0 | ISSUE | +wallet_to.available | да |
| 1 | TRANSFER | wallet_from.available → wallet_to.available | да |
| 2 | BLOCK | wallet_from.available → .blocked | да |
| 3 | UNBLOCK | wallet_from.blocked → .available | да |
| 4 | **WALLET_ONLY** (новый) | wallet_from.available → wallet_to.available | **нет** |

`WALLET_ONLY` используется когда средства перекладываются между аналитическими
разрезами одного бухсчёта (пример: инвестиция 80 → 80, не меняет бухучёт).

## Реестр операций (20 записей)

### Registrator (reg.*)

| code | Walletop | Dr/Cr | Wallet | Назначение |
|:---|:---|:---:|:---|:---|
| `reg.entrfee` | ISSUE | 51/86 | ENTRANCE_FEES 3001 | Вступительный взнос |
| `reg.minshare` | ISSUE | 51/80 | MIN_SHARE_FUND 2002 | Минимальный паевой взнос |

### Wallet (wall.*)

| code | Walletop | Dr/Cr | Wallet | Назначение |
|:---|:---|:---:|:---|:---|
| `wall.depcpl` | ISSUE | 51/80 | SHARE_FUND_PAY 2001 | Внесение паевого взноса |
| `wall.wthcpl` | TRANSFER | 80/51 | 2001 → 4001 | Возврат паевого взноса |

### Capital (cap.*)

| code | Walletop | Dr/Cr | Wallet | Назначение |
|:---|:---|:---:|:---|:---|
| `cap.import` | ISSUE | 51/80 | BLAGOROST_INVEST 9001 | Импорт пайщика Благорост (offline) |
| `cap.invest` | WALLET_ONLY | — | 2001 → 9001 | Инвестиция в ЦПП Благорост |
| `cap.commit` | ISSUE | **08/80** | GENERATOR_COMMIT 10001 | **Коммит РИД** — эмитится на `capital::approvecmmt` (одобрение коммита мастером), по дельте `segment.available_for_program`. Собирает 08 частями. |
| `cap.accept` | TRANSFER | **04/08** | 10001 → BLAGOROST_RID 9002 | **Приём РИД в НМА** — эмитится на `capital::signact2` на полный накопленный `available_for_program`. Закрывает 08 в ноль. |
| `cap.act2prp` | ISSUE | 51/80 | BLAGOROST_PROPERTY 9003 | Акт-2 имущественный паевой взнос |
| `cap.lnissue` | ISSUE | 58/51 | LOAN_ISSUED 4051 | Выдача пайщику беспроцентного займа |
| `cap.lnrepay` | TRANSFER | 80/58 | 4051 → SHARE_FUND_PAY 2001 | Возврат займа через акт-2 |

**Коммит РИД** (process_type `cap.apprvcmmt`) — одобрение коммита мастером в `capital::approvecmmt`:
- `cap.commit` (Dr 08 / Cr 80) эмитится на дельту `segment.available_for_program`
  (intellectual_cost − debt_amount) с `process_hash = project_hash`.
- У одного проекта может быть множество одобренных коммитов — все группируются в один процесс.

**Акт-2 Благорост** (process_type `cap.act2res`) — подписание акта-2 председателем в `capital::signact2`:
1. `cap.accept` (Dr 04 / Cr 08) — 08 закрывается, РИД принят в НМА на полный накопленный `segment.available_for_program`.
2. `cap.lnrepay` (Dr 80 / Cr 58) — опционально, если у пайщика был заём.

**Инвариант**: Σ `cap.commit` по сегменту (одобренные коммиты) == `cap.accept` по этому же сегменту в signact2 → `GENERATOR_COMMIT` (10001) закрывается в ноль, счёт 08 по сегменту закрывается в ноль.

### Marketplace (mkt.*)

| code | Walletop | Dr/Cr | Wallet | Назначение |
|:---|:---|:---:|:---|:---|
| `mkt.supplcnf` | ISSUE | 51/80 | SHARE_FUND_PAY 2001 | Подтверждение поставки |
| `mkt.recvcnf` | TRANSFER | 80/51 | 2001 → 4002 | Подтверждение получения (выплата поставщику) |

### Soviet (sov.*)

| code | Walletop | Dr/Cr | Wallet | Назначение |
|:---|:---|:---:|:---|:---|
| `sov.axncnv` | TRANSFER | 80/86 | SHARE_FUND_PAY 2001 → DELEGATE_FEES 3003 | Трансляция паевого взноса в делегатский членский |

### Миграция (mig.*)

Два независимых потока:

**A. Бухгалтерский перенос** `legacy::ledger::accounts` — через 4 inline
`apply(TRANSIT_*)` с полной двойной проводкой. Охватывает только то, что
проходит через legacy-счета 51/80/86 (+04 для РИД Восхода).

| code | Walletop | Dr/Cr | Wallet | Что покрывает |
|:---|:---|:---:|:---|:---|
| `mig.minshr` | ISSUE | 51/80 | MIN_SHARE_FUND 2002 | N_active × cooperative.minimum |
| `mig.share` | ISSUE | 51/80 | SHARE_FUND_PAY 2001 | share_money − min_total |
| `mig.entry` | ISSUE | 51/86 | ENTRANCE_FEES 3001 | entry_legacy |
| `mig.rid` | ISSUE | 04/80 | SHARE_FUND_RID 2003 | rid_share (= share_legacy − share_money) |

**B. Программные кошельки** `soviet::progwallets` — **прямой emplace в
wallets2** БЕЗ бух-проводок. Причина: `progwallets.blocked` и
`legacy::ledger::accounts` — параллельные системы учёта, progwallet не
синхронизирован с 80-м счётом. Любая бух-проводка при переносе progwallet
привела бы к двойному учёту.

| wallet-цель | Что переносим |
|:---|:---|
| BLAGOROST_INVEST 9001 | Σ progwallet[blagorost, program_id=4].blocked |
| GENERATOR_COMMIT 10001 | Σ progwallet[generator, program_id=3].blocked |

**Инварианты миграции A (eosio::check):**
- `cash_legacy  ≥ entry_legacy`  (иначе entry > cash)
- `share_legacy ≥ share_money`   (rid_share не может быть отрицательным)

При нарушении — миграция откатывается с диагностическим сообщением.

## Процессы (process_type → action_code)

| process_type | Входящие action_code | Entity table / field |
|:---|:---|:---|
| `reg.regist` | `reg.entrfee` + `reg.minshare` | candidates2 / registration_hash |
| `wall.deposit` | `wall.depcpl` | deposits / deposit_hash |
| `wall.withdrw` | `wall.wthcpl` | withdraws / withdraw_hash |
| `cap.capimp` | `cap.import` | contributors / contributor_hash |
| `cap.invest` | `cap.invest` | contributors / contributor_hash |
| `cap.loan` | `cap.lnissue` | debts / debt_hash |
| `cap.apprvcmmt` | `cap.commit` | projects / project_hash |
| `cap.act2res` | `cap.accept` + (опц.) `cap.lnrepay` | results / result_hash |
| `cap.act2prp` | `cap.act2prp` | pgproperties / property_hash |
| `mkt.offereq` | `mkt.supplcnf` + `mkt.recvcnf` | requests / hash |
| `sov.axncnv` | `sov.axncnv` | — (из blockchain_actions + document) |
| `mig.transit` | `mig.minshr` + `mig.blago` + `mig.share` + `mig.entry` + `mig.commit` + `mig.rid` | — |

Источник истины — `components/controller/src/domain/process-registry/config/process-hash-locator.ts`
(ACTION_CODE_TO_PROCESS_TYPE + PROCESS_HASH_LOCATOR).
