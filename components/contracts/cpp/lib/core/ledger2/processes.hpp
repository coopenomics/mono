#pragma once

#include <eosio/name.hpp>

/**
 * @brief Типы процессов ledger2 (process_type).
 *
 * Процесс — юридически значимая цепочка (`process_type`, `process_hash`,
 * `coopname`) ссылок, размазанная по ончейн-записям (сущностным таблицам).
 *
 * `process_type` называет контракт-инициатор при вызове `ledger2::apply` — имя
 * нитки эмитится в цепь вместе с операцией, а не выводится по operation_code.
 * Так процесс называет тот, кто нитку открыл: `branch::accrue` зачисляет
 * членский взнос КУ внутри нитки поставки (`p.mkt.supply`) и возврата
 * (`p.mkt.return`), хотя сама операция относится к экономике КУ. Пока имя
 * выводилось по операции, у такой нитки было два претендента на название, и
 * поставка подписывалась «Членские взносы кооперативного участка».
 *
 * Поле `process_type` в `OPERATION_REGISTRY` (operations.hpp) — типовая
 * принадлежность операции: контрактом не читается, бэкенду нужна только для
 * записей, сделанных до появления эмиссии имени.
 *
 * Один `process_type` может соответствовать нескольким operation_code — это
 * явно разрешённая модель мульти-операционных процессов:
 *   - processes::registrator::ACCEPT  ← o.reg.payent + o.reg.putmin
 *   - processes::capital::RID         ← o.cap.commit + o.cap.accept (+ o.cap.repay) + o.cap.cnvshr/o.cap.cnvbl
 *   - processes::marketplace::SUPPLY  ← o.mkt.lock + o.mkt.unlock + o.mkt.purch +
 *                                       o.mkt.payout + o.mkt.consum
 *   - processes::marketplace::RETURN  ← o.mkt.return
 *   - processes::marketplace::WRITEOFF ← o.mkt.wroff
 *
 * Одноактовые процессы: `capital::IMPORT`, `capital::PROPERTY`,
 * `capital::INVEST`, `soviet::AXN_CONVERT` (process_type совпадает с
 * operation_code по сути).
 *
 * Имена — eosio::name, ≤ 12 символов (13-й символ с ограничением
 * алфавита — избегаем). Формат: `p.<contract>.<noun>`:
 *   - `p.` префикс процесса (отличается от `o.` у operation_code),
 *   - `<contract>` — контракт-источник (`reg`, `wal`, `cap`, `mkt`, `sov`, `mig`).
 *
 * Нейминг-рефакторинг 2026-04-24: файл переименован из `process_types.hpp`
 * в `processes.hpp`, namespace `process_types` → `processes::<contract>`.
 *
 * @ingroup public_ledger2_consts
 */
namespace processes {

  // registrator
  namespace registrator {
    inline constexpr eosio::name ACCEPT    = "p.reg.accept"_n;   ///< Приём пайщика в кооператив (o.reg.payent + o.reg.putmin; для потока через совет — o.reg.inpay + o.reg.setmin + o.reg.setent).
    inline constexpr eosio::name REFUND    = "p.reg.refund"_n;   ///< Возврат регистрационного взноса при отказе совета (o.reg.refund). Отдельный процесс: приём взноса прерывается, начинается возврат.
  }

  // wallet
  namespace wallet {
    inline constexpr eosio::name DEPOSIT   = "p.wal.depo"_n;     ///< Внесение паевого взноса деньгами.
    inline constexpr eosio::name WITHDRAW  = "p.wal.wthdrw"_n;   ///< Возврат паевого взноса пайщику.
  }

  // capital
  namespace capital {
    inline constexpr eosio::name IMPORT    = "p.cap.import"_n;   ///< Оффлайн-импорт пайщика Благорост (o.cap.drppre (опц.) + o.cap.import).
    inline constexpr eosio::name INVEST    = "p.cap.invest"_n;   ///< Инвестиция в ЦПП Благорост (wallet-only 2001→9001).
    inline constexpr eosio::name DEBT      = "p.cap.debt"_n;     ///< Займ пайщику (o.cap.lend; возврат o.cap.repay — в p.cap.rid на акте-2).
    inline constexpr eosio::name RID       = "p.cap.rid"_n;      ///< Приём РИД в паевой фонд: o.cap.commit (коммиты) + o.cap.accept (акт-2) + опц. o.cap.repay + o.cap.cnvshr/o.cap.cnvbl (финальная конвертация сегмента). Анкер процесса — result_hash.
    inline constexpr eosio::name PROPERTY  = "p.cap.prop"_n;     ///< Приём имущественного паевого взноса (одноактовый).
    inline constexpr eosio::name PREIMP    = "p.cap.preimp"_n;   ///< Первичный учёт РИД-взноса до перехода на электронный учёт (одноактовый, anchor = preimp register hash).
    inline constexpr eosio::name WTHCAP    = "p.cap.wthcap"_n;   ///< Возврат паевого из ЦПП «Благорост» в кошелёк пайщика (одноактовый).
    inline constexpr eosio::name PGEXP     = "p.cap.pgexp"_n;    ///< Пул программных расходов: пополнение из инвестиций программы (o.cap.pgtop, одноактовый).
  }

  // marketplace
  namespace marketplace {
    inline constexpr eosio::name SUPPLY    = "p.mkt.supply"_n;   ///< Прямая поставка-приобретение имущества (5 операций: o.mkt.lock + o.mkt.unlock + o.mkt.purch + o.mkt.payout + o.mkt.consum).
    inline constexpr eosio::name RETURN    = "p.mkt.return"_n;   ///< Гарантийный возврат имущества пайщиком — compensating forward к o.mkt.consum (o.mkt.return).
    inline constexpr eosio::name WRITEOFF  = "p.mkt.wroff"_n;    ///< Утилизация скоропорта со склада КУ (o.mkt.wroff, по протоколу совета).
  }

  // branch — экономика кооперативного участка (requirement b6)
  namespace branch {
    inline constexpr eosio::name FEES  = "p.brn.fees"_n;  ///< Членские взносы КУ: зачисление в общий кошелёк при финализации заказа (o.brn.common), ручное распределение председателем (o.brn.release + o.brn.person) и использование персональных средств доверенным (o.brn.conv).
    inline constexpr eosio::name AID   = "p.brn.aid"_n;   ///< Материальная помощь доверенному КУ из его персонального кошелька (o.brn.aid; заявление → выплата кассиром).
    inline constexpr eosio::name SPEND = "p.brn.spend"_n; ///< Оплата расхода КУ из общего кошелька (o.brn.spend; команда председателя → выплата кассиром по реквизитам). Плановый реестр расходов и резерв 30 дней ведёт бэкенд.
  }

  // expense — шасси расходов (СЗ → авторизация → платёж → отчёт → закрытие)
  namespace expense {
    inline constexpr eosio::name PROPOSAL  = "p.exp.expns"_n;    ///< Цикл расхода по СЗ: o.exp.blgadv|blgdir (платёж) + опц. o.exp.over (перерасход) + o.exp.advrpt (отчёт ADVANCE) + опц. o.exp.advret (возврат). Анкер процесса — proposal_hash.
  }

  // soviet
  namespace soviet {
    inline constexpr eosio::name AXN_CONVERT = "p.sov.axncnv"_n; ///< Конвертация паевого RUB → делегатский ЧВ (одноактовый).
    inline constexpr eosio::name TAX         = "p.sov.tax"_n;    ///< Перечисление удержанного налога в бюджет (заявка бухгалтера → платёж кассира → закрытие обязательства). Собственная нитка, а не продолжение выплаты: платёж гасит удержания всех программ сразу, и привязать его к одной выплате нельзя.
  }

  // billing (Epic 12 — контракт billing)
  // ВНИМАНИЕ: имя константы НЕ `FUND` — `FUND` занят макросом `#define FUND "fund"`
  // в consts.hpp (имя контракта fund). Используем `CONVERT` (бэкенд-имя действия).
  namespace billing {
    inline constexpr eosio::name CONVERT = "p.bil.fund"_n; ///< Пополнение биллинг-кошелька пайщика (трансляция паевого в членский, одноактовый; anchor = hash заявления document2).
    inline constexpr eosio::name PAY     = "p.bil.pay"_n;  ///< Оплата подписки с биллинг-кошелька (одноактовый; anchor = payment_hash из БД провайдера).
  }

  // migration
  namespace migration {
    inline constexpr eosio::name TRANSIT   = "p.mig.trans"_n;    ///< Транзитный перенос остатков legacy (серия apply на кооп).
  }

  // adjustment (ручные корректировки председателя — walmove + revert)
  //
  // Не идёт через ledger2::apply: операции o.adj.* выполняются отдельными
  // top-level actions ledger2::walmove и ledger2::revert (см. operations.hpp,
  // OPERATION_ADJUSTMENT_REGISTRY). Один общий process_type p.adj.fix —
  // потому что аудит-цепочка корректировки одноактовая (нет «pending» фазы).
  namespace adjustment {
    inline constexpr eosio::name CORRECTION = "p.adj.fix"_n;     ///< Ручная корректировка председателя (перевод между кошельками или откат операции).
  }

/**
 * @brief Перечень известных имён процессов — для валидации в ledger2::apply.
 *
 * Имя нитки называет контракт-инициатор при вызове `apply`, поэтому опечатка в
 * имени иначе ушла бы в историю молча и процесс остался бы без названия на
 * столе бухгалтера. Порядок записей не важен (линейный поиск).
 *
 * Каждое добавленное сюда имя обязано иметь человеческое название в реестре
 * процессов `cooptypes/src/ledger2/processes.ts` — иначе интерфейс покажет
 * технический код вместо названия.
 */
static constexpr eosio::name PROCESS_REGISTRY[] = {
  registrator::ACCEPT,   registrator::REFUND,
  wallet::DEPOSIT,       wallet::WITHDRAW,
  capital::IMPORT,       capital::INVEST,      capital::DEBT,
  capital::RID,          capital::PROPERTY,    capital::PREIMP,
  capital::WTHCAP,       capital::PGEXP,
  marketplace::SUPPLY,   marketplace::RETURN,  marketplace::WRITEOFF,
  branch::FEES,          branch::AID,          branch::SPEND,
  expense::PROPOSAL,
  billing::CONVERT,      billing::PAY,
  soviet::AXN_CONVERT,   soviet::TAX,
  migration::TRANSIT,
  adjustment::CORRECTION,
};

/// @brief Известно ли имя нитки процесса (см. PROCESS_REGISTRY).
inline bool is_known_process(eosio::name process_type) {
  for (const auto& known : PROCESS_REGISTRY) {
    if (known == process_type) return true;
  }
  return false;
}

/// @brief Уникальность имён в PROCESS_REGISTRY — проверяется на сборке.
constexpr bool process_registry_is_unique() {
  constexpr auto count = sizeof(PROCESS_REGISTRY) / sizeof(PROCESS_REGISTRY[0]);
  for (unsigned i = 0; i < count; ++i) {
    for (unsigned j = i + 1; j < count; ++j) {
      if (PROCESS_REGISTRY[i].value == PROCESS_REGISTRY[j].value) return false;
    }
  }
  return true;
}

// Дубль в перечне означает, что имя завели дважды — линейный поиск это
// проглотит, а рассинхронизацию с cooptypes/локатором заметить будет негде.
static_assert(process_registry_is_unique(),
              "PROCESS_REGISTRY содержит дубликаты имён процессов");

} // namespace processes
