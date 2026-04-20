#pragma once

#include <eosio/name.hpp>

/**
 * @brief Типы процессов ledger2 (process_type).
 *
 * Процесс — это семантическая цепочка (process_type, process_hash, coopname)
 * ссылок, размазанная по ончейн-записям (wjournal/journal/сущностные таблицы).
 * `process_type` выводится бэкендом по action_code из `ACTION_REGISTRY`; на
 * контракте он используется только как значение поля в wjournal/journal.
 *
 * Один `process_type` может соответствовать нескольким action_code — это
 * явно разрешённая модель мульти-операционных процессов:
 *   - reg.regist  = reg.entrfee + reg.minshare
 *   - cap.act2res = cap.act2shr + cap.act2ln
 *   - mkt.offereq = mkt.supplcnf + mkt.recvcnf
 *
 * Одноактовые процессы: cap.capimp, cap.act2prp, sov.axncnv
 * (process_type совпадает с action_code по сути).
 *
 * Имена — eosio::name, ≤ 13 base32-символов с точкой, с обязательным
 * префиксом контракта-источника.
 *
 * @ingroup public_ledger2_consts
 */
namespace process_types {
  inline constexpr eosio::name REGISTRATION          = "reg.regist"_n;    ///< registrator: регистрация пайщика (reg.entrfee + reg.minshare)
  inline constexpr eosio::name WALLET_DEPOSIT        = "wall.deposit"_n;  ///< wallet: внесение паевого взноса
  inline constexpr eosio::name WALLET_WITHDRAW       = "wall.withdrw"_n;  ///< wallet: возврат паевого взноса
  inline constexpr eosio::name CAPITAL_IMPORT        = "cap.capimp"_n;    ///< capital: импорт пайщика (Благорост offline)
  inline constexpr eosio::name CAPITAL_INVEST        = "cap.invest"_n;    ///< capital: инвестиция в ЦПП Благорост (wallet-only 2001→9001)
  inline constexpr eosio::name CAPITAL_LOAN          = "cap.loan"_n;      ///< capital: заём пайщику (cap.loanissue + cap.loanrepay)
  inline constexpr eosio::name CAPITAL_ACT2_RESULT   = "cap.act2res"_n;   ///< capital: акт-2 результат РИД (cap.commit + cap.accept + cap.loanrepay)
  inline constexpr eosio::name CAPITAL_ACT2_PROPERTY = "cap.act2prp"_n;   ///< capital: акт-2 программного имущественного взноса
  inline constexpr eosio::name MARKETPLACE_OFFER     = "mkt.offereq"_n;   ///< marketplace: цикл оффера (mkt.supplcnf + mkt.recvcnf)
  inline constexpr eosio::name SOVIET_AXN_CONVERT    = "sov.axncnv"_n;    ///< soviet: конвертация RUB→AXN (одноактовый)

  // Технические процессы (миграция)
  inline constexpr eosio::name TRANSIT_MIGRATION     = "mig.transit"_n;   ///< migrate: транзитный перенос остатков legacy (серия apply на кооп)
}
