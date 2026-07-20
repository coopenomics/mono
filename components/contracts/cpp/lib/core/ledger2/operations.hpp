#pragma once

#include <array>
#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

#include "accounts.hpp"
#include "processes.hpp"
#include "wallets.hpp"

/**
 * @brief Реестр именованных операций ledger2 (operation registry).
 *
 * Нейминг-рефакторинг 2026-04-24:
 *   - Раньше файл назывался `actions.hpp`, массив — `ACTION_REGISTRY`,
 *     namespace — `ledger2_ops`. Термин «action» конфликтовал с
 *     `[[eosio::action]]`, смысл operation (walletop + опц. Dr/Cr) был смазан.
 *     Теперь — «операция» (operation): атомарная единица учёта ledger2.
 *   - eosio::name-строки получили префикс `o.` (operation), чтобы
 *     отличаться от process_type (`p.`) и не коллидировать по смыслу.
 *   - C++-константы разложены по вложенным namespace по контрактам-источникам
 *     (`operations::registrator::`, `operations::capital::` и т.д.) — контракт
 *     считывается по месту вызова.
 *
 * Пересмотр 2026-05-05 (ADR-003, ADR-009):
 *   - План счетов: 04, 08, 51, 58, 80, 86.
 *   - Коммит РИД разделён на `o.cap.commit` (Dr 08/Cr 80) и `o.cap.accept`
 *     (Dr 04/Cr 08, TRANSFER GENERATOR_FUND → BLAGOROST_FUND).
 *   - `WalletOp::WALLET_ONLY` удалён (ADR-003): «без бухпроводок» определяется
 *     парой `(debit_account_id == 0, credit_account_id == 0)` на уровне записи.
 *     Для `o.cap.invest` теперь TRANSFER без проводок (оба account_id == 0).
 *   - `WalletOp::BURN` (ADR-003): `available -= amount` на `wallet_from`,
 *     без `wallet_to`. Используется в `o.wal.wthcpl` (сжигание резерва возврата
 *     с `w.wal.wpend`), `o.cap.drppre` и как зеркало ISSUE в `revert`.
 *   - Единые программные кошельки: `BLAGOROST_FUND` (`w.cap.blago`) и
 *     `GENERATOR_FUND` (`w.cap.gen`) — заменили ранее декомпозированные
 *     `bginv/bgprop/bgrid/bgmem` и `gncom/gnmem` (ADR-009).
 *   - Миграционные операции — namespace `operations::migration`.
 *
 * Реестр — строго хардкод. Новая операция требует релиза контракта.
 * На один `code` приходится ровно одна запись в `OPERATION_REGISTRY` и
 * атомарно одно движение кошелька + (для Dr/Cr-операций) одна пара проводок.
 *
 * Именование eosio::name:
 *   - `o.<contract>.<verb>`, до 12 символов (13-й символ eosio::name имеет
 *     ограничения по алфавиту — избегаем заранее).
 *   - Префиксы контрактов: `reg`, `wal` (сокр. wallet), `cap`, `mkt`, `sov`, `brn` (branch), `mig`.
 *
 * @ingroup public_ledger2_consts
 */
namespace operations {

  // registrator
  namespace registrator {
    inline constexpr eosio::name PAY_ENTRANCE  = "o.reg.payent"_n;  ///< Оплата вступительного взноса (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES). Одношаговый путь adduser (без совета).
    inline constexpr eosio::name PUT_MINSHARE  = "o.reg.putmin"_n;  ///< Внесение минимального паевого при регистрации (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND). Одношаговый путь adduser (без совета).
    // Двухфазный путь через совет (reguser → confirmpay → confirmreg/declinereg):
    inline constexpr eosio::name RECEIVE_PAYMENT = "o.reg.inpay"_n;  ///< Приём регистрационного взноса кассой в ожидание решения совета (Dr 51 / Cr 76, ISSUE REGISTRATION_PENDING).
    inline constexpr eosio::name SETTLE_MINSHARE = "o.reg.setmin"_n; ///< Зачисление минимального паевого по решению совета (Dr 76 / Cr 80, TRANSFER REGISTRATION_PENDING → MIN_SHARE_FUND).
    inline constexpr eosio::name SETTLE_ENTRANCE = "o.reg.setent"_n; ///< Зачисление вступительного по решению совета (Dr 76 / Cr 86, TRANSFER REGISTRATION_PENDING → ENTRANCE_FEES).
    inline constexpr eosio::name REFUND          = "o.reg.refund"_n; ///< Возврат регистрационного взноса при отказе совета (Dr 76 / Cr 51, BURN REGISTRATION_PENDING — деньги уходят из системы банковским переводом кандидату).
    inline constexpr eosio::name MOVE_MINSHARE   = "o.reg.mvmin"_n;  ///< Перенос минимального паевого на главный паевой при выходе из кооператива (TRANSFER MIN_SHARE_FUND → SHARE_FUND_PAY, без Dr/Cr — оба кошелька на счёте 80). Готовит полный паевой к возврату.
  }

  // wallet
  namespace wallet {
    inline constexpr eosio::name COMPLETE_DEPOSIT  = "o.wal.depcpl"_n;  ///< Завершение внесения паевого взноса (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY).
    inline constexpr eosio::name COMPLETE_WITHDRAW = "o.wal.wthcpl"_n;  ///< Завершение возврата паевого взноса (Dr 80 / Cr 51, BURN с WITHDRAW_PENDING — деньги уходят из системы, без wallet_to).
    inline constexpr eosio::name REQUEST_WITHDRAW  = "o.wal.wthreq"_n;  ///< Запрос на возврат паевого: TRANSFER SHARE_FUND_PAY → WITHDRAW_PENDING (резерв, без Dr/Cr).
    inline constexpr eosio::name DECLINE_WITHDRAW  = "o.wal.wthdec"_n;  ///< Отклонение запроса на возврат: TRANSFER WITHDRAW_PENDING → SHARE_FUND_PAY (снятие резерва, без Dr/Cr).
    inline constexpr eosio::name CONVERT_TO_MEMBER = "o.wal.conv"_n;    ///< Конвертация цифрового рубля в универсальный членский кошелёк (Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → CK_MEMBER). Conditional-шаг серии createorder в «Столе заказов».
  }

  // capital
  namespace capital {
    inline constexpr eosio::name IMPORT              = "o.cap.import"_n;   ///< Оффлайн-импорт пайщика Благорост (Dr 04 / Cr 80, ISSUE BLAGOROST_FUND). Только РИД-имущество — деньги через INVEST.
    inline constexpr eosio::name INVEST              = "o.cap.invest"_n;   ///< Инвестиция в ЦПП Благорост (TRANSFER SHARE_FUND_PAY → BLAGOROST_FUND, без Dr/Cr).
    inline constexpr eosio::name COMMIT_RID          = "o.cap.commit"_n;   ///< Коммит РИД (Dr 08 / Cr 80, ISSUE GENERATOR_FUND).
    inline constexpr eosio::name ACCEPT_RID          = "o.cap.accept"_n;   ///< Приём РИД в НМА (Dr 04 / Cr 08, NONE — только бухпроводка, кошелёк остаётся на GENERATOR_FUND до конвертации сегмента).
    inline constexpr eosio::name ACCEPT_PROPERTY     = "o.cap.actprp"_n;   ///< Акт-2 имущественный паевой взнос (Dr 04 / Cr 80, ISSUE BLAGOROST_FUND).
    inline constexpr eosio::name PREIMP              = "o.cap.preimp"_n;   ///< Первичный учёт РИД-взноса до перехода на электронный учёт (Dr 04 / Cr 80, ISSUE PREIMP_FUND).
    inline constexpr eosio::name DROP_PREIMP         = "o.cap.drppre"_n;   ///< Закрытие пред-импорт-учёта при переходе на электронный учёт (Dr 80 / Cr 04, BURN PREIMP_FUND). Вызывается из capital::importcontr перед o.cap.import.
    inline constexpr eosio::name LEND                = "o.cap.lend"_n;     ///< Выдача беспроцентного займа пайщику (Dr 58 / Cr 51, ISSUE LOAN_ISSUED).
    inline constexpr eosio::name REPAY               = "o.cap.repay"_n;    ///< Возврат займа пайщика по акту-2 (Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY).
    inline constexpr eosio::name WITHDRAW_FROM_CAPITAL = "o.cap.wthcap"_n; ///< Возврат паевого из ЦПП «Благорост» в кошелёк пайщика (TRANSFER BLAGOROST_FUND → SHARE_FUND_PAY, без Dr/Cr).
    inline constexpr eosio::name CONVERT_TO_SHARE    = "o.cap.cnvshr"_n;   ///< Конвертация сегмента: РИД → главный кошелёк (TRANSFER GENERATOR_FUND → SHARE_FUND_PAY, без Dr/Cr — бухпроводка уже была сделана в ACCEPT_RID).
    inline constexpr eosio::name CONVERT_TO_BLAGO    = "o.cap.cnvbl"_n;    ///< Конвертация сегмента: РИД → ЦПП «Благорост» (TRANSFER GENERATOR_FUND → BLAGOROST_FUND, без Dr/Cr — бухпроводка уже была сделана в ACCEPT_RID).
    inline constexpr eosio::name PROGRAM_EXPENSE_TOPUP = "o.cap.pgtop"_n; ///< Пополнение пула программных расходов из инвестиций программы (ISSUE PROGRAM_EXPENSE_POOL, без Dr/Cr — деньги уже на 51, выделяется кооперативный резерв под расходы; паевые L3-кошельки пайщиков не трогаются).
  }

  // marketplace — членская модель «Стола заказов».
  namespace marketplace {
    inline constexpr eosio::name LOCK_ORDER             = "o.mkt.lock"_n;     ///< Резервирование средств заказчика под конкретный Order (TRANSFER w.wal.share → w.mkt.order, Dr 80 / Cr 86 — паевой переходит в целевое финансирование на резерв-кошелёк). Единственный обязательный шаг ledger2 при createorder.
    inline constexpr eosio::name CONVERT_TO_MKT_MEMBER  = "o.mkt.conv"_n;     ///< Конвертация паевого взноса в членский кошелёк «Стола заказов» (TRANSFER w.wal.share → w.mkt.member, Dr 80 / Cr 86). ЕДИНСТВЕННЫЙ путь паевой→членский — только по Заявлению о конвертации (action convert). Автоматической конвертации на выдаче (signiss2) НЕТ: доплата/довзнос по факту берутся с уже внесённого членского (o.mkt.lockm/o.mkt.lockmf), при нехватке — отказ.
    inline constexpr eosio::name LOCK_FROM_MEMBER       = "o.mkt.lockm"_n;    ///< Добор резерва заказа с членского «Стола заказов» (TRANSFER w.mkt.member → w.mkt.order, без Dr/Cr — оба кошелька на 86). Парный к o.mkt.conv шаг доплаты по факту: после конвертации добирает резерв под этот же Order.
    inline constexpr eosio::name UNLOCK_ORDER           = "o.mkt.unlock"_n;   ///< Снятие резерва при отмене Order'а или недовыдаче (TRANSFER w.mkt.order → w.mkt.member, без Dr/Cr — оба кошелька на 86). Средства возвращаются на членский «Стола заказов» (не на универсальный членский) — остаются в программе и могут быть потрачены на следующие заказы.
    inline constexpr eosio::name PURCHASE_FROM_SUPPLIER = "o.mkt.purch"_n;    ///< Приёмка имущества кооперативом по АПП приёмки от поставщика (Dr 10 / Cr 86, NONE — только бухпроводка, кошельки не двигаются; имущество — аналитика по 10). Атомарно с PAY_SUPPLIER на закрывающей подписи председателя.
    inline constexpr eosio::name PAY_SUPPLIER           = "o.mkt.payout"_n;   ///< Оплата поставщику с расчётного счёта по факту приёмки (Dr 86 / Cr 51, ISSUE ∅ → SUPPLIER_PAYMENTS). Атомарно с PURCHASE_FROM_SUPPLIER.
    inline constexpr eosio::name CONSUME_BY_MEMBER      = "o.mkt.consum"_n;   ///< Выдача имущества пайщику по АПП выдачи (BURN с w.mkt.order, Dr 86 / Cr 10 — сжигание резерва заказа и выбытие имущества со склада через целевое финансирование).
    inline constexpr eosio::name RETURN_BY_MEMBER       = "o.mkt.return"_n;   ///< Гарантийный возврат имущества пайщиком — compensating forward к CONSUME_BY_MEMBER (ISSUE ∅ → w.mkt.member, Dr 10 / Cr 86 — восстановление средств на членском «Стола заказов» заказчика и возврат имущества на склад). Реверты ledger2::revert в Столе заказов не используются.
    inline constexpr eosio::name WRITE_OFF_PERISHABLE   = "o.mkt.wroff"_n;    ///< Утилизация скоропорта со склада (NONE Dr 86 / Cr 10). По протоколу совета.
    inline constexpr eosio::name MARKDOWN_LOSS          = "o.mkt.loss"_n;     ///< Уценка при выдаче из остатка кооператива (NONE Dr 91 / Cr 10): разница между ценой прибытия и фактической ценой выдачи выбывает со склада в прочие расходы. Вместе с o.mkt.consum даёт выбытие по полной стоимости прибытия — на счёте 10 ничего не зависает. Накопленный расход на 91 погашается позже отдельным процессом (Dr 86 / Cr 91, аналогично списанию скоропорта через совет — пока не реализован, requirement 76 вопрос 4).
    inline constexpr eosio::name MEMBERSHIP_FEE_LOCK    = "o.mkt.fee"_n;      ///< Блокировка членского взноса при создании заказа (TRANSFER w.wal.share → w.mkt.fee, Dr 80 / Cr 86 — как o.mkt.lock). Взнос считается от единой ставки кооператива и фиксируется явным полем Order.membership_fee; на signiss2 при факте больше заказа — дособирается этой же операцией.
    inline constexpr eosio::name MEMBERSHIP_FEE_REFUND  = "o.mkt.refund"_n;   ///< Возврат неиспользованной части членского взноса (TRANSFER w.mkt.fee → w.mkt.member, без Dr/Cr — оба кошелька на 86). Срабатывает при отмене заказа (полностью) и при недовыдаче (пропорционально факту); симметричен o.mkt.unlock для резерва стоимости.
    inline constexpr eosio::name LOCK_FEE_FROM_MEMBER   = "o.mkt.lockmf"_n;   ///< Блокировка членского взноса под заказ из уже внесённых членских средств пайщика (TRANSFER w.mkt.member → w.mkt.fee, без Dr/Cr — оба кошелька на 86). Парный по взносу к o.mkt.lockm (тот добирает тело заказа): stockorder фондируется из членского кошелька «Стола заказов» начисто, паевой сперва конвертируется отдельным действием (o.mkt.conv). Инверсия o.mkt.refund.
    inline constexpr eosio::name REFUSAL_PENALTY        = "o.mkt.penal"_n;    ///< Удержание 50% при отказе пайщика от получения после акцепта поставщиком (TRANSFER w.mkt.order → w.mkt.fee, без Dr/Cr — оба кошелька на 86). Транзит: удержанная половина тела заказа кладётся в пул членских взносов, откуда вместе с удержанной половиной взноса единым o.brn.common (Branch::accrue) зачисляется в общий кошелёк КУ. Прямой TRANSFER w.mkt.order[пайщик] → w.brn.common[braname] невозможен — walletop держит один username на обе стороны. Имущество остаётся на складе КУ; вторая половина возвращается пайщику (o.mkt.unlock + o.mkt.refund).
  }

  // branch — экономика кооперативного участка (requirement b6).
  namespace branch {
    inline constexpr eosio::name DISTRIBUTE_PERSONAL = "o.brn.person"_n;  ///< Распределение доверенному/председателю КУ при ручном распределении председателем (TRANSFER w.brn.pool → w.brn.person, без Dr/Cr — внутри 86). Доля = вес/Σвесов из реестра весов branch::weights; вторая нога двухходовки после o.brn.release.
    inline constexpr eosio::name DISTRIBUTE_COMMON   = "o.brn.common"_n;  ///< Зачисление 100% членского взноса в общий кошелёк КУ при финализации заказа (TRANSFER w.mkt.fee → w.brn.common, без Dr/Cr — внутри 86; username = braname КУ). Вызывается branch::accrue инлайн от контракта-источника.
    inline constexpr eosio::name RELEASE_FROM_COMMON = "o.brn.release"_n; ///< Изъятие из общего кошелька КУ в транзитный пул ручного распределения (TRANSFER w.brn.common → w.brn.pool, без Dr/Cr — внутри 86; username = braname). Первая нога двухходовки распределения: один username на операцию — поэтому common→person идёт через COOPERATIVE-транзит w.brn.pool.
    inline constexpr eosio::name SPEND_COMMON        = "o.brn.spend"_n;   ///< Оплата расхода кооперативного участка из общего кошелька (BURN с w.brn.common, Dr 86 / Cr 51 — выплата с расчётного счёта по реквизитам, после подтверждения кассиром). Плановый резерв расходов контролирует бэкенд; путь использования включается с шасси расходов.
    inline constexpr eosio::name FINANCIAL_AID       = "o.brn.aid"_n;     ///< Материальная помощь доверенному КУ (BURN с w.brn.person, Dr 86 / Cr 51 — выплата с расчётного счёта по заявлению, после подтверждения кассиром; НДФЛ получатель платит сам).
    inline constexpr eosio::name CONVERT_TO_MKT      = "o.brn.conv"_n;    ///< Перевод персональных средств доверенного в членский кошелёк «Стола заказов» (TRANSFER w.brn.person → w.mkt.member, без Dr/Cr — внутри 86) для заказов как обычный пайщик.
  }

  // soviet
  namespace soviet {
    inline constexpr eosio::name CONVERT_AXN      = "o.sov.axncnv"_n;   ///< Трансляция паевого взноса в членский (Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES).
  }

  // expense — шасси расходов (MVP: только Благорост; хозрасходы из членских — отдельный эпик).
  //
  // Принципы (см. components/desktop/extensions/expenses/NAMING-C28-28.md):
  //   - Контракт `expense` универсальный: operation_code передаётся в payload.
  //   - Источник оплат — КООПЕРАТИВНЫЙ пул расходов (PROGRAM_EXPENSE_POOL),
  //     пополняемый o.cap.pgtop; личные L3-кошельки пайщиков (w.cap.blago)
  //     при оплатах СЗ не изменяются.
  //   - При расходе из Благороста паевой фонд (80) НЕ трогается: меняется только форма
  //     актива 51 → 08 (Дт 08 / Кт 51 для обеих механик).
  //   - ADVANCE-отчёт (`o.exp.advrpt`) НЕ создаёт новой бухпроводки: проводка уже
  //     сделана на `o.exp.blgadv` при выдаче.
  //   - Callback на финализацию — переменная (`callback{contract, action, data}`),
  //     заполняется при `expense::createexp`; expense ничего не знает про capital.
  namespace expense {
    inline constexpr eosio::name BLAGO_ADVANCE    = "o.exp.blgadv"_n;   ///< Выдача подотчётных из пула расходов (TRANSFER PROGRAM_EXPENSE_POOL → ADVANCE_HOLD, Dr 08 / Cr 51).
    inline constexpr eosio::name BLAGO_DIRECT     = "o.exp.blgdir"_n;   ///< Прямая оплата из пула расходов (BURN PROGRAM_EXPENSE_POOL, Dr 08 / Cr 51).
    inline constexpr eosio::name ADVANCE_REPORT   = "o.exp.advrpt"_n;   ///< Закрытие подотчёта пайщика (BURN ADVANCE_HOLD, без бухпроводки — canal 08/51 уже сделан на blgadv).
    inline constexpr eosio::name ADVANCE_RETURN   = "o.exp.advret"_n;   ///< Возврат неиспользованного подотчёта (TRANSFER ADVANCE_HOLD → PROGRAM_EXPENSE_POOL, Dr 51 / Cr 08).
    inline constexpr eosio::name OVERSPEND        = "o.exp.over"_n;     ///< Доплата сверх подотчёта (TRANSFER PROGRAM_EXPENSE_POOL → ADVANCE_HOLD, Dr 08 / Cr 51); сразу за ней expense вызывает ADVANCE_REPORT.
  }

  // migration (только из migrate.cpp)
  //
  // В OPERATION_REGISTRY включены **только** те транзиты, которые проводятся
  // через `ledger::accounts` (51/80/86). Программные кошельки soviet::progwallets
  // (Благорост, Генератор) мигрируются отдельным прямым `wallets2.emplace`
  // в migrate.cpp — БЕЗ бух-проводок, поскольку в legacy::ledger::accounts
  // этих сумм нет (soviet::progwallets и ledger::accounts — параллельные
  // системы учёта, не синхронизированные).
  namespace migration {
    inline constexpr eosio::name MIN_SHARE        = "o.mig.minshr"_n;   ///< Перенос: минимальный паевой взнос (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND).
    inline constexpr eosio::name SHARE            = "o.mig.share"_n;    ///< Перенос: остаток паевых деньгами (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY).
    inline constexpr eosio::name ENTRY            = "o.mig.entry"_n;    ///< Перенос: вступительные (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES).
  }

  // adjustment (ручные корректировки председателя)
  //
  // Не входят в OPERATION_REGISTRY: их параметры (wallet_from/to,
  // debit/credit_account_id) задаются динамически каждый вызов, что несовместимо
  // со static_assert проверками реестра. Выполняются отдельными actions:
  //   - ledger2::walmove — WALMOVE: перевод между кошельками одного бух.счёта;
  //   - ledger2::revert  — REVERSAL: зеркальная проводка по operation_id оригинала.
  // Для UI human_name → см. OPERATION_ADJUSTMENT_REGISTRY ниже.
  namespace adjustment {
    inline constexpr eosio::name WALMOVE  = "o.adj.walmove"_n;          ///< Перевод между кошельками внутри одного бух.счёта (без Dr/Cr).
    inline constexpr eosio::name REVERSAL = "o.adj.rev"_n;              ///< Откат операции: зеркальная проводка по operation_id.
  }

} // namespace operations

/**
 * @brief Элементарные операции по кошелькам (ADR-003).
 *
 * Семантика «без бухпроводок» — НЕ через отдельный walletop, а через пару
 * `(debit_account_id == 0, credit_account_id == 0)` на уровне записи реестра.
 * Compile-time правило `(debit==0) ⇔ (credit==0)` ловит смешанные пары.
 */
//
// Удаление BLOCK/UNBLOCK/BURN_BLOCKED (2026-05-24): механика «заблокированного»
// баланса упразднена. Резерв средств под заявку на возврат паевого теперь
// выражается переводом на отдельный кошелёк-резерв `w.wal.wpend` (TRANSFER),
// возврат резерва — обратным TRANSFER, завершение — BURN с резерва. Поле
// `blocked` в таблицах wallets2/userwallets оставлено deprecated (всегда 0
// после ledger2::migrate-свёртки) — физическое удаление поля = небезопасная
// смена layout таблицы на живых коопах, выносится в отдельный cleanup-деплой.
//
// Числовые значения ISSUE/TRANSFER/BURN/NONE СОХРАНЕНЫ (не перенумерованы),
// чтобы исторические op_code в blockchain_actions читались бэкендом без сдвига
// смысла (2 и 3 — бывшие BLOCK/UNBLOCK — больше не выдаются и невалидны на входе).
enum class WalletOp : uint8_t {
  ISSUE        = 0, ///< первичный вход средств на кошелёк wallet_to (wallet_from = empty)
  TRANSFER     = 1, ///< перемещение wallet_from → wallet_to (с Dr/Cr ИЛИ без — по парам account_id)
  BURN         = 4, ///< изъятие amount с wallet_from->available, без wallet_to. Покрывает оба кейса: (a) штатное сжигание как бизнес-операция в OPERATION_REGISTRY; (b) зеркало ISSUE при `ledger2::revert` (различие — через operation_code: `o.adj.rev` для adjustment-mirror).
  NONE         = 5, ///< только бухпроводка без перемещения средств (wallet_from = empty, wallet_to = empty, debit ≠ 0, credit ≠ 0). Покрывает кейсы внутрибалансовых проводок типа Dr 04 / Cr 08 (приём РИД в НМА), когда кошелёк уже на нужном программном фонде.
};

/**
 * @brief Описание одной именованной операции.
 *
 * Семантика полей по `wallet_op`:
 *   - ISSUE:   wallet_from = eosio::name{}, wallet_to = required.
 *   - TRANSFER: wallet_from = required, wallet_to = required (≠ from).
 *   - BURN: wallet_from = required, wallet_to = eosio::name{}.
 *
 * Семантика бух.проводки:
 *   - Без проводок: debit_account_id == 0 И credit_account_id == 0.
 *   - С проводкой:  оба ≠ 0, ≠ друг друга, оба из LEDGER2_ACCOUNT_MAP.
 *   - Смешанная пара (один == 0, второй ≠ 0) запрещена compile-time.
 */
struct OperationRegistryEntry {
  eosio::name    code;               ///< operation_code с префиксом `o.<contract>.<verb>`
  eosio::name    process_type;       ///< тип процесса с префиксом `p.<contract>.<noun>`
  WalletOp       wallet_op;
  eosio::name    wallet_from;        ///< пустое имя для ISSUE
  eosio::name    wallet_to;          ///< пустое имя для BURN
  uint64_t       debit_account_id;   ///< 0 если без бухпроводки (тогда credit_account_id тоже == 0)
  uint64_t       credit_account_id;  ///< 0 если без бухпроводки (тогда debit_account_id тоже == 0)
  const char*    human_name;
};

/**
 * @brief Хардкод-реестр именованных операций.
 *
 * Порядок записей не важен (линейный поиск в ledger2::apply).
 */
static constexpr OperationRegistryEntry OPERATION_REGISTRY[] = {
  // 1. Вступительный взнос: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { operations::registrator::PAY_ENTRANCE, processes::registrator::ACCEPT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Вступительный взнос пайщика" },

  // 2. Минимальный паевой взнос (при регистрации): Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { operations::registrator::PUT_MINSHARE, processes::registrator::ACCEPT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос пайщика при регистрации" },

  // 2a. Приём регистрационного взноса кассой (поток через совет): Dr 51 / Cr 76, ISSUE REGISTRATION_PENDING.
  // Деньги получены, но взнос ещё не признан — висит на расчётах с пайщиком (76)
  // до решения совета. Сумма = вступительный + минимальный паевой.
  { operations::registrator::RECEIVE_PAYMENT, processes::registrator::ACCEPT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::REGISTRATION_PENDING,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::PARTICIPANT_SETTLEMENTS,
    "Приём регистрационного взноса в ожидание решения совета" },

  // 2b. Зачисление минимального паевого по решению совета: Dr 76 / Cr 80, TRANSFER REGISTRATION_PENDING → MIN_SHARE_FUND.
  { operations::registrator::SETTLE_MINSHARE, processes::registrator::ACCEPT, WalletOp::TRANSFER,
    ledger2_wallets::REGISTRATION_PENDING, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::PARTICIPANT_SETTLEMENTS, ledger2_accounts::SHARE_FUND,
    "Зачисление минимального паевого взноса по решению совета" },

  // 2c. Зачисление вступительного по решению совета: Dr 76 / Cr 86, TRANSFER REGISTRATION_PENDING → ENTRANCE_FEES.
  { operations::registrator::SETTLE_ENTRANCE, processes::registrator::ACCEPT, WalletOp::TRANSFER,
    ledger2_wallets::REGISTRATION_PENDING, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::PARTICIPANT_SETTLEMENTS, ledger2_accounts::TARGET_RECEIPTS,
    "Зачисление вступительного взноса по решению совета" },

  // 2d. Возврат регистрационного взноса при отказе совета: Dr 76 / Cr 51, BURN REGISTRATION_PENDING.
  // Отдельный процесс p.reg.refund: приём взноса прерывается, начинается возврат.
  // Деньги уходят из системы (банковский перевод кандидату), получателя на цепи нет.
  { operations::registrator::REFUND, processes::registrator::REFUND, WalletOp::BURN,
    ledger2_wallets::REGISTRATION_PENDING, eosio::name{},
    ledger2_accounts::PARTICIPANT_SETTLEMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Возврат регистрационного взноса при отказе совета" },

  // 2e. Перенос минимального паевого на главный при выходе из кооператива:
  // TRANSFER MIN_SHARE_FUND → SHARE_FUND_PAY (без Dr/Cr — оба кошелька на счёте 80).
  // Консолидирует минимальный паевой на главный, чтобы вернуть его вместе с
  // основным паевым через wallet-withdraw (o.wal.wthcpl, Дт 80 / Кт 51).
  { operations::registrator::MOVE_MINSHARE, processes::wallet::WITHDRAW, WalletOp::TRANSFER,
    ledger2_wallets::MIN_SHARE_FUND, ledger2_wallets::SHARE_FUND_PAY,
    0, 0,
    "Перенос минимального паевого на главный при выходе из кооператива" },

  // 3. Внесение паевого взноса: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { operations::wallet::COMPLETE_DEPOSIT, processes::wallet::DEPOSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат паевого взноса: Dr 80 / Cr 51, BURN WITHDRAW_PENDING.
  // Сжигание из кошелька-резерва (TRANSFER в резерв был на REQUEST_WITHDRAW):
  // деньги уходят из системы (банковский перевод пайщику), получателя на цепи нет.
  // Бухгалтерия: паевой фонд уменьшается (Дт 80), расчётный счёт уменьшается (Кт 51).
  { operations::wallet::COMPLETE_WITHDRAW, processes::wallet::WITHDRAW, WalletOp::BURN,
    ledger2_wallets::WITHDRAW_PENDING, eosio::name{},
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Импорт пайщика Благорост (offline): Dr 04 / Cr 80, ISSUE BLAGOROST_FUND (ADR-009: единый кошелёк программы).
  // Импорт фиксирует РИД-имущество пайщика как НМА — поэтому Dr 04, не Dr 51.
  // Денежные взносы в Благорост идут через `o.cap.invest` (TRANSFER SHARE_FUND_PAY → BLAGOROST_FUND).
  { operations::capital::IMPORT, processes::capital::IMPORT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::BLAGOROST_FUND,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Паевой взнос по целевой потребительской программе «Благорост» (офлайн-импорт)" },

  // 6. Инвестиция из Цифрового Кошелька в Благорост: TRANSFER SHARE_FUND_PAY → BLAGOROST_FUND (без Dr/Cr — оба счёта 80)
  { operations::capital::INVEST, processes::capital::INVEST, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::BLAGOROST_FUND,
    0, 0,
    "Инвестиция в ЦПП «Благорост»" },

  // 7. Коммит РИД: Dr 08 / Cr 80, ISSUE GENERATOR_FUND (ADR-009: единый кошелёк программы Генератор)
  { operations::capital::COMMIT_RID, processes::capital::RID, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::GENERATOR_FUND,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::SHARE_FUND,
    "Коммит результата интеллектуальной деятельности по программе «Генератор»" },

  // 8. Приём РИД в НМА: Dr 04 / Cr 08, NONE — кошелёк остаётся на GENERATOR_FUND.
  // Семантика: подписан акт-2, РИД принят как НМА (закрылся 08-й). Перемещение
  // кошелька (на ЦК или на Благорост) делается отдельным шагом — convertsegm,
  // после голосования сегмента.
  { operations::capital::ACCEPT_RID, processes::capital::RID, WalletOp::NONE,
    eosio::name{}, eosio::name{},
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::NON_CURRENT_INVESTMENTS,
    "Приём результата интеллектуальной деятельности в паевой фонд" },

  // 9. Акт-2 имущественный паевой взнос: Dr 04 / Cr 80, ISSUE BLAGOROST_FUND (ADR-009).
  // Имущественный (РИД) — Dr 04 (НМА), не Dr 51 (банк). Денежный паевой —
  // через o.wal.depcpl или o.cap.invest.
  { operations::capital::ACCEPT_PROPERTY, processes::capital::PROPERTY, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::BLAGOROST_FUND,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Паевой взнос (не денежный) по программе «Благорост»" },

  // 9a. Первичный учёт РИД-взноса: Dr 04 / Cr 80, ISSUE PREIMP_FUND.
  // Пайщик внёс РИД-имущество ДО перехода кооператива на электронный учёт.
  // Балансы фиксируются на отдельном кошельке `w.cap.preimp`, чтобы при
  // `capital::importcontr` их можно было обнулить через `o.cap.drppre` и
  // переоткрыть на полный объём через `o.cap.import` под единый Благорост-фонд.
  { operations::capital::PREIMP, processes::capital::PREIMP, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::PREIMP_FUND,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Первичный учёт РИД-взноса до перехода на электронный учёт" },

  // 9b. Закрытие пред-импорт-учёта: Dr 80 / Cr 04, BURN PREIMP_FUND.
  // Вызывается из `capital::importcontr` ДО `o.cap.import`, если у пайщика
  // есть запись в `userwallets[w.cap.preimp]`. После закрытия `o.cap.import`
  // переоткрывает учёт на полный объём (включая возможную доплату).
  { operations::capital::DROP_PREIMP, processes::capital::IMPORT, WalletOp::BURN,
    ledger2_wallets::PREIMP_FUND, eosio::name{},
    ledger2_accounts::SHARE_FUND, ledger2_accounts::INTANGIBLE_ASSETS,
    "Закрытие пред-импорт-учёта РИД-взноса при переходе на электронный учёт" },

  // 10. Выдача беспроцентного займа пайщику: Dr 58 / Cr 51, ISSUE LOAN_ISSUED
  { operations::capital::LEND, processes::capital::DEBT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::LOAN_ISSUED,
    ledger2_accounts::FINANCIAL_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Выдача пайщику беспроцентного займа" },

  // 11. Возврат займа по акту-2: Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY
  { operations::capital::REPAY, processes::capital::RID, WalletOp::TRANSFER,
    ledger2_wallets::LOAN_ISSUED, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::FINANCIAL_INVESTMENTS,
    "Возврат беспроцентного займа пайщика по акту-2" },

  // 12a. p.mkt.supply: Резервирование под Order (TRANSFER w.wal.share → w.mkt.order,
  //      Dr 80 / Cr 86). Единственный обязательный шаг ledger2 при createorder.
  //      Паевой переходит в целевое финансирование на резерв-кошелёк под
  //      конкретный заказ.
  { operations::marketplace::LOCK_ORDER, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::MARKETPLACE_ORDER_LOCK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Резервирование под заказ" },

  // 12a². p.mkt.supply: Конвертация паевого в членский «Стола заказов» под доплату
  //       (TRANSFER w.wal.share → w.mkt.member, Dr 80 / Cr 86). signiss2 при
  //       actual > ordered: доплата идёт ИМЕННО с членского программы — паевой
  //       сперва конвертируется сюда, напрямую с паевого не списываем.
  { operations::marketplace::CONVERT_TO_MKT_MEMBER, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::MARKETPLACE_MEMBER_FUND,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Конвертация паевого в членский «Стола заказов» под доплату" },

  // 12a³. p.mkt.supply: Добор резерва заказа с членского «Стола заказов»
  //       (TRANSFER w.mkt.member → w.mkt.order, без Dr/Cr — оба кошелька на 86).
  //       Парный к CONVERT_TO_MKT_MEMBER шаг доплаты по факту.
  { operations::marketplace::LOCK_FROM_MEMBER, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_MEMBER_FUND, ledger2_wallets::MARKETPLACE_ORDER_LOCK,
    0, 0,
    "Добор резерва заказа с членского «Стола заказов»" },

  // 12b. p.mkt.supply: Снятие резерва (TRANSFER w.mkt.order → w.mkt.member,
  //      без Dr/Cr — оба кошелька на 86). Срабатывает на cancelorder /
  //      declineorder / expireorder; для signiss2 — на разницу при
  //      actual < ordered. Средства возвращаются на членский «Стола заказов»
  //      (не на универсальный членский) — остаются в программе.
  { operations::marketplace::UNLOCK_ORDER, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_ORDER_LOCK, ledger2_wallets::MARKETPLACE_MEMBER_FUND,
    0, 0,
    "Снятие резерва при отмене заказа" },

  // 12b². p.mkt.supply: Удержание 50% при отказе пайщика от получения после
  //       акцепта поставщиком (TRANSFER w.mkt.order → w.mkt.fee, без Dr/Cr —
  //       оба кошелька на 86). Транзит: удержанная половина тела заказа кладётся
  //       в пул членских взносов, откуда вместе с удержанной половиной взноса
  //       единым Branch::accrue (o.brn.common) уходит в общий кошелёк КУ.
  //       Прямой перевод на w.brn.common невозможен — walletop держит один
  //       username на обе стороны (USER_SHARED[пайщик] ↛ USER_SHARED[braname]).
  { operations::marketplace::REFUSAL_PENALTY, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_ORDER_LOCK, ledger2_wallets::MARKETPLACE_FEE_POOL,
    0, 0,
    "Удержание при отказе пайщика от получения после акцепта поставщиком" },

  // 12c. p.mkt.supply: Приёмка имущества кооперативом по АПП приёмки
  //      (Dr 10 / Cr 86, NONE — только бухпроводка, кошельки не двигаются).
  //      Имущество — аналитикой по счёту 10 (per-КУ субсчета), без отдельного кошелька.
  //      Атомарно с PAY_SUPPLIER на закрывающей подписи председателя АПП приёмки.
  { operations::marketplace::PURCHASE_FROM_SUPPLIER, processes::marketplace::SUPPLY, WalletOp::NONE,
    eosio::name{}, eosio::name{},
    ledger2_accounts::MATERIALS, ledger2_accounts::TARGET_RECEIPTS,
    "Приёмка имущества кооперативом по АПП приёмки" },

  // 12d. p.mkt.supply: Оплата поставщику с расчётного счёта
  //      (Dr 86 / Cr 51, ISSUE ∅ → w.mkt.payout). Атомарно с PURCHASE_FROM_SUPPLIER.
  { operations::marketplace::PAY_SUPPLIER, processes::marketplace::SUPPLY, WalletOp::ISSUE,
    eosio::name{}, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::TARGET_RECEIPTS, ledger2_accounts::BANK_ACCOUNT,
    "Оплата поставщику с расчётного счёта по факту приёмки" },

  // 12e. p.mkt.supply: Выдача имущества пайщику по АПП выдачи
  //      (BURN с w.mkt.order, Dr 86 / Cr 10 — сжигание резерва заказа и
  //      выбытие имущества со склада через целевое финансирование).
  { operations::marketplace::CONSUME_BY_MEMBER, processes::marketplace::SUPPLY, WalletOp::BURN,
    ledger2_wallets::MARKETPLACE_ORDER_LOCK, eosio::name{},
    ledger2_accounts::TARGET_RECEIPTS, ledger2_accounts::MATERIALS,
    "Выдача имущества пайщику по АПП выдачи" },

  // 12f. p.mkt.return: Гарантийный возврат имущества пайщиком
  //      (ISSUE ∅ → w.mkt.member, Dr 10 / Cr 86 — восстановление средств на
  //      членском «Стола заказов» заказчика и возврат имущества на склад).
  //      Compensating forward к CONSUME_BY_MEMBER; ledger2::revert в Столе
  //      заказов не используется.
  { operations::marketplace::RETURN_BY_MEMBER, processes::marketplace::RETURN, WalletOp::ISSUE,
    eosio::name{}, ledger2_wallets::MARKETPLACE_MEMBER_FUND,
    ledger2_accounts::MATERIALS, ledger2_accounts::TARGET_RECEIPTS,
    "Гарантийный возврат — восстановление средств и имущества" },

  // 12g. p.mkt.wroff: Утилизация скоропорта со склада (NONE Dr 86 / Cr 10).
  //      По протоколу совета.
  { operations::marketplace::WRITE_OFF_PERISHABLE, processes::marketplace::WRITEOFF, WalletOp::NONE,
    eosio::name{}, eosio::name{},
    ledger2_accounts::TARGET_RECEIPTS, ledger2_accounts::MATERIALS,
    "Утилизация скоропорта" },

  // 12h. p.mkt.supply: Уценка при выдаче из остатка кооператива (NONE Dr 91 / Cr 10).
  //      Имущество выбывает со склада по полной стоимости прибытия: фактическую
  //      сумму выдачи закрывает o.mkt.consum, разницу уценки — эта операция в
  //      прочие расходы. Погашение накопленного на 91 (Dr 86 / Cr 91) — будущий
  //      отдельный процесс по образцу списания скоропорта (requirement 76, в. 4).
  { operations::marketplace::MARKDOWN_LOSS, processes::marketplace::SUPPLY, WalletOp::NONE,
    eosio::name{}, eosio::name{},
    ledger2_accounts::OTHER_INCOME_EXPENSES, ledger2_accounts::MATERIALS,
    "Уценка имущества при выдаче со склада кооператива" },

  // 12i. p.mkt.supply: Блокировка членского взноса при создании заказа
  //      (TRANSFER w.wal.share → w.mkt.fee, Dr 80 / Cr 86 — как o.mkt.lock).
  //      Единая ставка кооператива; сумма фиксируется в Order.membership_fee.
  { operations::marketplace::MEMBERSHIP_FEE_LOCK, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::MARKETPLACE_FEE_POOL,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Членский взнос «Стола заказов» по заказу" },

  // 12j. p.mkt.supply: Возврат неиспользованной части членского взноса
  //      (TRANSFER w.mkt.fee → w.mkt.member, без Dr/Cr — оба кошелька на 86).
  //      Отмена заказа — полностью; недовыдача — пропорционально факту.
  { operations::marketplace::MEMBERSHIP_FEE_REFUND, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_FEE_POOL, ledger2_wallets::MARKETPLACE_MEMBER_FUND,
    0, 0,
    "Возврат членского взноса по заказу" },

  // 12j². p.mkt.supply: Блокировка членского взноса под заказ из остатка из уже
  //       внесённых членских средств (TRANSFER w.mkt.member → w.mkt.fee, без Dr/Cr —
  //       оба кошелька на 86). Парный по взносу к LOCK_FROM_MEMBER (тело): stockorder
  //       фондируется из членского начисто; паевой конвертируется заранее отдельным
  //       действием (CONVERT_TO_MKT_MEMBER). Инверсия MEMBERSHIP_FEE_REFUND.
  { operations::marketplace::LOCK_FEE_FROM_MEMBER, processes::marketplace::SUPPLY, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_MEMBER_FUND, ledger2_wallets::MARKETPLACE_FEE_POOL,
    0, 0,
    "Членский взнос «Стола заказов» из внесённых средств" },

  // 13a. p.brn.fees: Зачисление 100% членского взноса в общий кошелёк КУ
  //      (TRANSFER w.mkt.fee → w.brn.common, без Dr/Cr — внутри 86; username = braname).
  //      Вызывается branch::accrue инлайн от контракта-источника при финализации заказа.
  { operations::branch::DISTRIBUTE_COMMON, processes::branch::FEES, WalletOp::TRANSFER,
    ledger2_wallets::MARKETPLACE_FEE_POOL, ledger2_wallets::BRANCH_COMMON,
    0, 0,
    "Членский взнос в общий кошелёк кооперативного участка" },

  // 13b-1. p.brn.fees: Изъятие из общего кошелька КУ на ручное распределение
  //      (TRANSFER w.brn.common → w.brn.pool, без Dr/Cr — внутри 86; username = braname).
  //      Первая нога двухходовки branch::distribute: walletop несёт один username,
  //      поэтому common(braname) → person(доверенный) идёт через COOPERATIVE-транзит.
  { operations::branch::RELEASE_FROM_COMMON, processes::branch::FEES, WalletOp::TRANSFER,
    ledger2_wallets::BRANCH_COMMON, ledger2_wallets::BRANCH_DISTRIBUTION_POOL,
    0, 0,
    "Изъятие из общего кошелька кооперативного участка на распределение" },

  // 13b-2. p.brn.fees: Распределение доверенному КУ по весам
  //      (TRANSFER w.brn.pool → w.brn.person, без Dr/Cr — внутри 86).
  //      Вторая нога двухходовки branch::distribute (ручная команда председателя,
  //      доля = вес/Σвесов; остаток округления не покидает общий кошелёк).
  { operations::branch::DISTRIBUTE_PERSONAL, processes::branch::FEES, WalletOp::TRANSFER,
    ledger2_wallets::BRANCH_DISTRIBUTION_POOL, ledger2_wallets::BRANCH_PERSONAL,
    0, 0,
    "Распределение членского взноса доверенному кооперативного участка" },

  // 13b-3. p.brn.spend: Оплата расхода КУ из общего кошелька
  //      (BURN с w.brn.common, Dr 86 / Cr 51 — деньги уходят из системы
  //      банковским переводом по реквизитам после подтверждения кассиром).
  { operations::branch::SPEND_COMMON, processes::branch::SPEND, WalletOp::BURN,
    ledger2_wallets::BRANCH_COMMON, eosio::name{},
    ledger2_accounts::TARGET_RECEIPTS, ledger2_accounts::BANK_ACCOUNT,
    "Оплата расхода кооперативного участка из общего кошелька" },

  // 13c. p.brn.aid: Материальная помощь доверенному КУ
  //      (BURN с w.brn.person, Dr 86 / Cr 51 — деньги уходят из системы
  //      банковским переводом получателю после подтверждения кассиром).
  { operations::branch::FINANCIAL_AID, processes::branch::AID, WalletOp::BURN,
    ledger2_wallets::BRANCH_PERSONAL, eosio::name{},
    ledger2_accounts::TARGET_RECEIPTS, ledger2_accounts::BANK_ACCOUNT,
    "Материальная помощь доверенному кооперативного участка" },

  // 13d. p.brn.fees: Перевод персональных средств доверенного в членский
  //      кошелёк «Стола заказов» (TRANSFER w.brn.person → w.mkt.member,
  //      без Dr/Cr — внутри 86) для заказов как обычный пайщик.
  { operations::branch::CONVERT_TO_MKT, processes::branch::FEES, WalletOp::TRANSFER,
    ledger2_wallets::BRANCH_PERSONAL, ledger2_wallets::MARKETPLACE_MEMBER_FUND,
    0, 0,
    "Перевод персональных средств доверенного в членский кошелёк «Стола заказов»" },

  // 14. Конвертация в AXN: Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES
  { operations::soviet::CONVERT_AXN, processes::soviet::AXN_CONVERT, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Трансляция паевого взноса из ЦПП «Цифровой Кошелёк» в членский взнос за пользование инфраструктурой" },

  // 15. Запрос на возврат паевого: TRANSFER SHARE_FUND_PAY → WITHDRAW_PENDING
  // (без Dr/Cr — оба кошелька на счёте 80; резерв средств на время рассмотрения).
  { operations::wallet::REQUEST_WITHDRAW, processes::wallet::WITHDRAW, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::WITHDRAW_PENDING,
    0, 0,
    "Резервирование паевого под запрос на возврат" },

  // 16. Отклонение запроса на возврат: TRANSFER WITHDRAW_PENDING → SHARE_FUND_PAY
  // (без Dr/Cr — зеркало REQUEST_WITHDRAW; возврат резерва пайщику).
  { operations::wallet::DECLINE_WITHDRAW, processes::wallet::WITHDRAW, WalletOp::TRANSFER,
    ledger2_wallets::WITHDRAW_PENDING, ledger2_wallets::SHARE_FUND_PAY,
    0, 0,
    "Снятие резерва паевого после отклонения запроса на возврат" },

  // 17. Возврат из ЦПП «Благорост» в Цифровой Кошелёк: TRANSFER BLAGOROST_FUND → SHARE_FUND_PAY (без Dr/Cr — оба счёта 80, зеркало INVEST).
  { operations::capital::WITHDRAW_FROM_CAPITAL, processes::capital::WTHCAP, WalletOp::TRANSFER,
    ledger2_wallets::BLAGOROST_FUND, ledger2_wallets::SHARE_FUND_PAY,
    0, 0,
    "Возврат паевого из ЦПП «Благорост» в Цифровой Кошелёк" },

  // 18. Конвертация сегмента (часть в ЦК): TRANSFER GENERATOR_FUND → SHARE_FUND_PAY, без Dr/Cr.
  // Финальная фаза процесса p.cap.rid (после signact2). Бухпроводка
  // Dr 04 / Cr 08 уже сделана в ACCEPT_RID на полный available_for_program
  // сегмента; здесь только перемещаем кошелёк. process_hash = result_hash.
  { operations::capital::CONVERT_TO_SHARE, processes::capital::RID, WalletOp::TRANSFER,
    ledger2_wallets::GENERATOR_FUND, ledger2_wallets::SHARE_FUND_PAY,
    0, 0,
    "Конвертация сегмента: РИД → главный кошелёк" },

  // 19. Конвертация сегмента (часть в Благорост): TRANSFER GENERATOR_FUND → BLAGOROST_FUND, без Dr/Cr.
  // Финальная фаза процесса p.cap.rid (после signact2). Бухпроводка
  // Dr 04 / Cr 08 уже сделана в ACCEPT_RID; здесь только перенос кошелька
  // в программный фонд. process_hash = result_hash.
  { operations::capital::CONVERT_TO_BLAGO, processes::capital::RID, WalletOp::TRANSFER,
    ledger2_wallets::GENERATOR_FUND, ledger2_wallets::BLAGOROST_FUND,
    0, 0,
    "Конвертация сегмента: РИД → ЦПП «Благорост»" },

  // 19a. Пополнение пула программных расходов: ISSUE PROGRAM_EXPENSE_POOL, без Dr/Cr.
  // Совет выделяет часть свободных инвестиций программы под целевые расходы:
  // деньги физически на 51 с момента взносов, здесь появляется кооперативный
  // резерв-кошелёк, из которого шасси expense оплачивает СЗ. Паевые L3-кошельки
  // пайщиков (w.cap.blago, счёт 80) не изменяются — права требования сохраняются.
  { operations::capital::PROGRAM_EXPENSE_TOPUP, processes::capital::PGEXP, WalletOp::ISSUE,
    eosio::name{}, ledger2_wallets::PROGRAM_EXPENSE_POOL,
    0, 0,
    "Пополнение пула программных расходов ЦПП «Благорост»" },

  // ----- Шасси расходов (o.exp.*) — вызываются из контракта expense -----
  //
  // Базовое состояние Благороста ДО расхода:
  //   - Деньги физически на 51 с момента o.wal.depcpl (Dr 51 / Cr 80).
  //   - 80 (паевой) наполнен; кошелёк w.cap.blago.
  //   - 08 пустой (`o.cap.invest` — TRANSFER без проводок).
  //
  // Принцип: расход не уменьшает паевой фонд (80). Меняется только форма актива
  // 51 → 08 (банк уходит, появляется WIP-проект).

  // 20. Выдача подотчётных из пула программных расходов: Dr 08 / Cr 51,
  // TRANSFER PROGRAM_EXPENSE_POOL → ADVANCE_HOLD.
  // Источник — КООПЕРАТИВНЫЙ пул расходов (пополняется o.cap.pgtop); личные
  // L3-кошельки пайщиков (w.cap.blago) при оплате СЗ не трогаются — их паевые
  // взносы в программе не уменьшаются. Деньги физически уходят пайщику (Cr 51),
  // стоимость капитализируется в WIP (Dr 08). ADVANCE_HOLD фиксирует
  // ответственность получателя аванса (USER_SHARED) до отчёта.
  { operations::expense::BLAGO_ADVANCE, processes::expense::PROPOSAL, WalletOp::TRANSFER,
    ledger2_wallets::PROGRAM_EXPENSE_POOL, ledger2_wallets::ADVANCE_HOLD,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Выдача подотчётных из пула расходов ЦПП «Благорост»" },

  // 21. Прямая оплата из пула программных расходов (DIRECT): Dr 08 / Cr 51,
  // BURN PROGRAM_EXPENSE_POOL. Оплата организации по счёту; деньги уходят с 51,
  // стоимость капитализируется в 08. Кошелёк-резерв не задействован.
  { operations::expense::BLAGO_DIRECT, processes::expense::PROPOSAL, WalletOp::BURN,
    ledger2_wallets::PROGRAM_EXPENSE_POOL, eosio::name{},
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Прямая оплата из пула расходов ЦПП «Благорост»" },

  // 22. Закрытие подотчёта пайщика по отчёту: BURN ADVANCE_HOLD, БЕЗ бухпроводки.
  // Проводка Dr 08 / Cr 51 уже сделана на BLAGO_ADVANCE при выдаче. При отчёте только
  // снимается кошелёк-резерв пайщика — никакого canal 08/51 второй раз.
  { operations::expense::ADVANCE_REPORT, processes::expense::PROPOSAL, WalletOp::BURN,
    ledger2_wallets::ADVANCE_HOLD, eosio::name{},
    0, 0,
    "Закрытие подотчёта пайщика по отчёту" },

  // 23. Возврат неиспользованного подотчёта: Dr 51 / Cr 08,
  // TRANSFER ADVANCE_HOLD → PROGRAM_EXPENSE_POOL.
  // Зеркало BLAGO_ADVANCE: деньги возвращаются на 51, WIP-стоимость уменьшается,
  // остаток снова доступен пулу расходов.
  { operations::expense::ADVANCE_RETURN, processes::expense::PROPOSAL, WalletOp::TRANSFER,
    ledger2_wallets::ADVANCE_HOLD, ledger2_wallets::PROGRAM_EXPENSE_POOL,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::NON_CURRENT_INVESTMENTS,
    "Возврат неиспользованного подотчёта в пул расходов" },

  // 24. Доплата сверх подотчёта (перерасход): Dr 08 / Cr 51,
  // TRANSFER PROGRAM_EXPENSE_POOL → ADVANCE_HOLD.
  // Зеркало BLAGO_ADVANCE на сумму перерасхода. Контракт expense сразу за OVERSPEND
  // вызывает ADVANCE_REPORT — две последовательные записи в одной транзакции `expense::overspendexp`.
  { operations::expense::OVERSPEND, processes::expense::PROPOSAL, WalletOp::TRANSFER,
    ledger2_wallets::PROGRAM_EXPENSE_POOL, ledger2_wallets::ADVANCE_HOLD,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Доплата сверх подотчёта (перерасход)" },

  // ----- Миграционные (o.mig.*) — вызываются только из migrate.cpp -----

  // 15. Миграция: минимальный паевой: Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { operations::migration::MIN_SHARE, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: минимальные паевые взносы при миграции" },

  // 16. Миграция: остаток паевых деньгами: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { operations::migration::SHARE, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: остаток паевых взносов деньгами при миграции" },

  // 17. Миграция: вступительные: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { operations::migration::ENTRY, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Транзитный перенос: вступительные взносы при миграции" },
};

static constexpr size_t OPERATION_REGISTRY_SIZE = sizeof(OPERATION_REGISTRY) / sizeof(OPERATION_REGISTRY[0]);

// =====================================================================
// Compile-time валидация реестра.
// =====================================================================
//
// Правила (ADR-003):
//  1. `code` уникален. `process_type` может повторяться.
//  2. `(debit_account_id == 0) ⇔ (credit_account_id == 0)` — без частичных проводок.
//  3. Для записей с проводками (оба ≠ 0): `debit_account_id` ≠ `credit_account_id`,
//     оба существуют в `LEDGER2_ACCOUNT_MAP`.
//  4. Для TRANSFER: `wallet_from` ≠ `wallet_to`, оба ≠ 0.
//  5. Для ISSUE: `wallet_from` == 0 и `wallet_to` ≠ 0.
//  6. Для BURN: `wallet_from` ≠ 0, `wallet_to` == 0.
//  7. Все id кошельков из записей существуют в `LEDGER2_WALLET_REGISTRY`.
namespace ledger2_registry_detail {
  constexpr bool operation_codes_unique() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < OPERATION_REGISTRY_SIZE; ++j) {
        if (OPERATION_REGISTRY[i].code == OPERATION_REGISTRY[j].code) return false;
      }
    }
    return true;
  }

  // Правило 2: без частичных проводок. Либо оба == 0 (без бухпроводки), либо оба ≠ 0.
  constexpr bool zero_accounts_iff_both() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      const bool dr_zero = (e.debit_account_id  == 0);
      const bool cr_zero = (e.credit_account_id == 0);
      if (dr_zero != cr_zero) return false;
    }
    return true;
  }

  // Правило 3: при наличии проводки — debit ≠ credit.
  constexpr bool dr_ne_cr_when_posting() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.debit_account_id == 0 && e.credit_account_id == 0) continue; // без проводок
      if (e.debit_account_id == e.credit_account_id) return false;
    }
    return true;
  }

  // Правило 4: TRANSFER — wallet_from ≠ wallet_to, оба ≠ 0.
  constexpr bool transfer_wallet_from_ne_to() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op != WalletOp::TRANSFER) continue;
      if (e.wallet_from == e.wallet_to) return false;
      if (e.wallet_from.value == 0 || e.wallet_to.value == 0) return false;
    }
    return true;
  }

  // Правило 6: BURN — wallet_from required, wallet_to == 0 (ADR-003).
  constexpr bool burn_pattern_correct() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op != WalletOp::BURN) continue;
      if (e.wallet_from.value == 0) return false;
      if (e.wallet_to.value != 0)   return false;
    }
    return true;
  }

  // Правило 8: NONE — оба wallet пустые, обе проводки обязательны (Dr ≠ 0, Cr ≠ 0).
  // Семантика: только бухпроводка, кошельковое движение отсутствует.
  constexpr bool none_pattern_correct() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op != WalletOp::NONE) continue;
      if (e.wallet_from.value != 0) return false;
      if (e.wallet_to.value   != 0) return false;
      if (e.debit_account_id  == 0) return false;
      if (e.credit_account_id == 0) return false;
    }
    return true;
  }

  // Правило 3: оба account_id (если ≠ 0) существуют в LEDGER2_ACCOUNT_MAP.
  constexpr bool accounts_exist_in_map() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.debit_account_id == 0 && e.credit_account_id == 0) continue; // без проводок
      if (ledger2_find_account_meta(e.debit_account_id) == nullptr) return false;
      if (ledger2_find_account_meta(e.credit_account_id) == nullptr) return false;
    }
    return true;
  }

  // Правило 7: все ссылки на кошельки существуют в реестре.
  constexpr bool wallets_exist_in_registry() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_from.value != 0 && !ledger2_is_known_wallet(e.wallet_from)) return false;
      if (e.wallet_to.value   != 0 && !ledger2_is_known_wallet(e.wallet_to))   return false;
    }
    return true;
  }
}

static_assert(ledger2_registry_detail::operation_codes_unique(),
              "OPERATION_REGISTRY: duplicate operation_code detected");
static_assert(ledger2_registry_detail::zero_accounts_iff_both(),
              "OPERATION_REGISTRY: смешанная пара debit/credit account_id (один == 0, второй ≠ 0)");
static_assert(ledger2_registry_detail::dr_ne_cr_when_posting(),
              "OPERATION_REGISTRY: debit_account_id == credit_account_id (self-posting) при наличии проводки");
static_assert(ledger2_registry_detail::transfer_wallet_from_ne_to(),
              "OPERATION_REGISTRY: TRANSFER с wallet_from == wallet_to или одним из них == 0");
static_assert(ledger2_registry_detail::burn_pattern_correct(),
              "OPERATION_REGISTRY: BURN требует wallet_from ≠ 0 и wallet_to == 0");
static_assert(ledger2_registry_detail::none_pattern_correct(),
              "OPERATION_REGISTRY: NONE требует wallet_from == 0, wallet_to == 0 и обе проводки заполненными");
static_assert(ledger2_registry_detail::accounts_exist_in_map(),
              "OPERATION_REGISTRY: ссылка на account id вне LEDGER2_ACCOUNT_MAP");
static_assert(ledger2_registry_detail::wallets_exist_in_registry(),
              "OPERATION_REGISTRY: ссылка на wallet id вне LEDGER2_WALLET_REGISTRY");

/**
 * @brief Линейный поиск записи реестра по operation_code.
 */
inline const OperationRegistryEntry* find_operation(eosio::name operation_code) {
  for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
    if (OPERATION_REGISTRY[i].code == operation_code) {
      return &OPERATION_REGISTRY[i];
    }
  }
  return nullptr;
}

// =====================================================================
// Adjustment-операции (ручные корректировки) — отдельный мини-реестр.
// =====================================================================
//
// Зачем отдельно: у adjustment-операций wallet_from/wallet_to и
// debit/credit_account_id заполняются ДИНАМИЧЕСКИ при каждом вызове
// (определяются параметрами walmove/revert, не справочником). В
// OPERATION_REGISTRY их положить нельзя — сломаются static_assert
// (transfer_wallet_from_ne_to, zero_accounts_iff_both, dr_ne_cr_when_posting и пр.).
//
// Здесь — только code + process_type + human_name для UI/audit
// (cooptypes mirror живёт в src/ledger2/operations.ts → addAdjustment).
struct OperationAdjustmentEntry {
  eosio::name      code;
  eosio::name      process_type;
  std::string_view human_name;
};

inline constexpr std::array<OperationAdjustmentEntry, 2> OPERATION_ADJUSTMENT_REGISTRY = {{
  { operations::adjustment::WALMOVE,  processes::adjustment::CORRECTION, "Перевод между кошельками" },
  { operations::adjustment::REVERSAL, processes::adjustment::CORRECTION, "Откат операции" },
}};

inline constexpr const OperationAdjustmentEntry* find_adjustment(eosio::name operation_code) {
  for (size_t i = 0; i < OPERATION_ADJUSTMENT_REGISTRY.size(); ++i) {
    if (OPERATION_ADJUSTMENT_REGISTRY[i].code == operation_code) {
      return &OPERATION_ADJUSTMENT_REGISTRY[i];
    }
  }
  return nullptr;
}

// =====================================================================
// Наборы операций шасси расходов — фабричная настройка контракта expense.
// =====================================================================
//
// Контракт `expense` агностичен к программе-источнику: кошелёк-пул приходит в
// `createexp` параметром `source_wallet`, а ledger2-коды всех пяти операций
// жизненного цикла (аванс / прямая оплата / отчёт / возврат / перерасход)
// выводятся из этого кошелька через таблицу ниже — в коде expense нет ни
// одного захардкоженного operation_code.
//
// Подключение шасси к новому пулу (например, кошельку членских взносов
// кооперативного участка) = добавить 5 операций в OPERATION_REGISTRY и одну
// строку здесь. Контракт expense при этом не меняется.
struct ExpenseOperationSet {
  eosio::name source_wallet;  ///< пул-источник средств (COOPERATIVE-кошелёк)
  eosio::name advance;        ///< выдача аванса под отчёт (TRANSFER pool → подотчёт)
  eosio::name direct;         ///< прямая оплата организации по счёту (BURN pool)
  eosio::name report;         ///< закрытие подотчёта по отчёту (BURN подотчёта)
  eosio::name refund;         ///< возврат неиспользованного аванса (TRANSFER подотчёт → pool)
  eosio::name overspend;      ///< доплата при перерасходе (TRANSFER pool → подотчёт)
};

static constexpr ExpenseOperationSet EXPENSE_OPERATION_SETS[] = {
  // Пул программных расходов ЦПП «Благорост» — source_wallet заполняет
  // capital::createpgexp при создании СЗ через inline expense::createexp.
  { ledger2_wallets::PROGRAM_EXPENSE_POOL,
    operations::expense::BLAGO_ADVANCE,
    operations::expense::BLAGO_DIRECT,
    operations::expense::ADVANCE_REPORT,
    operations::expense::ADVANCE_RETURN,
    operations::expense::OVERSPEND },
};

static constexpr size_t EXPENSE_OPERATION_SETS_SIZE =
  sizeof(EXPENSE_OPERATION_SETS) / sizeof(EXPENSE_OPERATION_SETS[0]);

// Compile-time валидация наборов: каждый код существует в OPERATION_REGISTRY,
// тип wallet-операции и привязка кошельков соответствуют роли кода в наборе.
namespace ledger2_expense_sets_detail {
  constexpr const OperationRegistryEntry* find_op(eosio::name code) {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      if (OPERATION_REGISTRY[i].code == code) return &OPERATION_REGISTRY[i];
    }
    return nullptr;
  }

  constexpr bool source_wallets_unique() {
    for (size_t i = 0; i < EXPENSE_OPERATION_SETS_SIZE; ++i) {
      for (size_t j = i + 1; j < EXPENSE_OPERATION_SETS_SIZE; ++j) {
        if (EXPENSE_OPERATION_SETS[i].source_wallet == EXPENSE_OPERATION_SETS[j].source_wallet) {
          return false;
        }
      }
    }
    return true;
  }

  constexpr bool sets_consistent() {
    for (size_t i = 0; i < EXPENSE_OPERATION_SETS_SIZE; ++i) {
      const auto& s = EXPENSE_OPERATION_SETS[i];
      const auto* adv = find_op(s.advance);
      const auto* dir = find_op(s.direct);
      const auto* rep = find_op(s.report);
      const auto* ref = find_op(s.refund);
      const auto* ovr = find_op(s.overspend);
      if (!adv || !dir || !rep || !ref || !ovr) return false;
      // Аванс: пул → кошелёк-подотчёт.
      if (adv->wallet_op != WalletOp::TRANSFER || adv->wallet_from != s.source_wallet) return false;
      const eosio::name hold = adv->wallet_to;
      // Прямая оплата: сжигание с пула (подотчёт не задействован).
      if (dir->wallet_op != WalletOp::BURN || dir->wallet_from != s.source_wallet) return false;
      // Отчёт: сжигание подотчёта.
      if (rep->wallet_op != WalletOp::BURN || rep->wallet_from != hold) return false;
      // Возврат: подотчёт → пул.
      if (ref->wallet_op != WalletOp::TRANSFER ||
          ref->wallet_from != hold || ref->wallet_to != s.source_wallet) return false;
      // Перерасход: пул → подотчёт (зеркало аванса на сумму доплаты).
      if (ovr->wallet_op != WalletOp::TRANSFER ||
          ovr->wallet_from != s.source_wallet || ovr->wallet_to != hold) return false;
    }
    return true;
  }
} // namespace ledger2_expense_sets_detail

static_assert(ledger2_expense_sets_detail::source_wallets_unique(),
              "EXPENSE_OPERATION_SETS: source_wallet должен быть уникален");
static_assert(ledger2_expense_sets_detail::sets_consistent(),
              "EXPENSE_OPERATION_SETS: набор операций не согласован с OPERATION_REGISTRY "
              "(коды/типы wallet-операций/привязка кошельков)");

/**
 * @brief Поиск набора операций шасси расходов по кошельку-источнику.
 */
inline const ExpenseOperationSet* find_expense_operation_set(eosio::name source_wallet) {
  for (size_t i = 0; i < EXPENSE_OPERATION_SETS_SIZE; ++i) {
    if (EXPENSE_OPERATION_SETS[i].source_wallet == source_wallet) {
      return &EXPENSE_OPERATION_SETS[i];
    }
  }
  return nullptr;
}
