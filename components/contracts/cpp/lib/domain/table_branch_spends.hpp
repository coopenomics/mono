#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @brief Состояние команды оплаты расхода КУ из общего кошелька
 * (requirement b6 «Экономика КУ», раунд 5; процесс p.brn.spend).
 *
 * Выплата идёт через gateway::createoutpay → действие кассира → callback
 * `branch::spendconfirm` / `branch::spenddecline` (по образцу материальной
 * помощи p.brn.aid).
 *
 * Допустимые переходы:
 *   pending → completed — gateway::outcomplete → callback `spendconfirm`.
 *                         Здесь применяется o.brn.spend (Дт 86 / Кт 51).
 *   pending → declined  — gateway::outdecline → callback `spenddecline`.
 *                         Без ledger-движения; средства остаются на w.brn.common.
 */
namespace BranchSpendStatus {
  inline constexpr eosio::name PENDING   = "pending"_n;
  inline constexpr eosio::name COMPLETED = "completed"_n;
  inline constexpr eosio::name DECLINED  = "declined"_n;
}

/**
 * @brief Команда оплаты расхода кооперативного участка из общего кошелька
 * членских взносов (w.brn.common).
 *
 * Плановый реестр расходов и резерв 30 дней ведёт бэкенд (решение владельца
 * 2026-06-10: плановая информация — оффчейн, контракт лишь исполняет
 * списание). Реквизиты получателя — в план-записи бэкенда; memo хранит
 * назначение платежа. Средства резервно НЕ блокируются: при подтверждении
 * кассиром o.brn.spend (BURN с w.brn.common) сам упадёт, если баланса уже
 * не хватает.
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash используется как outcome_hash в gateway и как process_hash
 * ledger2-операции.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: spends
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_spend {
  uint64_t           id;              ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;            ///< идентификатор команды (= outcome_hash в gateway, = process_hash в ledger2)
  eosio::name        braname;         ///< кооперативный участок — владелец общего кошелька
  eosio::asset       amount;          ///< сумма оплаты
  eosio::name        status = BranchSpendStatus::PENDING;  ///< см. BranchSpendStatus
  std::string        memo;            ///< назначение платежа
  std::string        decline_reason;  ///< заполняется только при status == declined

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
  uint64_t by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
    "spends"_n, branch_spend,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_spend, eosio::checksum256, &branch_spend::by_hash>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_spend, uint64_t, &branch_spend::by_branch>>>
    branch_spends_index;
