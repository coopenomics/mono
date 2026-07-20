#pragma once

#include <eosio/name.hpp>

/**
 * @brief Типы процессов ledger2 (process_type).
 *
 * Процесс — юридически значимая цепочка (`process_type`, `process_hash`,
 * `coopname`) ссылок, размазанная по ончейн-записям (wjournal/journal/
 * сущностным таблицам). `process_type` выводится бэкендом по operation_code
 * из `OPERATION_REGISTRY`; на контракте он используется только как значение
 * поля в wjournal/journal.
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
    inline constexpr eosio::name ACCEPT    = "p.reg.accept"_n;   ///< Приём пайщика в кооператив (o.reg.payent + o.reg.putmin).
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

  // soviet
  namespace soviet {
    inline constexpr eosio::name AXN_CONVERT = "p.sov.axncnv"_n; ///< Конвертация паевого RUB → делегатский ЧВ (одноактовый).
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

} // namespace processes
