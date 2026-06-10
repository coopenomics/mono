#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/document.hpp"

/**
 * @brief Состояние заявки на материальную помощь доверенного КУ
 * (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Выплата идёт через gateway::createoutpay → действие кассира → callback
 * `branch::aidconfirm` / `branch::aiddecline` (по образцу выплаты поставщику
 * marketplace::payout, Locked Decision L12).
 *
 * Допустимые переходы:
 *   pending → completed — gateway::outcomplete → callback `aidconfirm`.
 *                         Здесь применяется o.brn.aid (Дт 86 / Кт 51).
 *   pending → declined  — gateway::outdecline → callback `aiddecline`.
 *                         Без ledger-движения; средства остаются на w.brn.person.
 */
namespace BranchAidStatus {
  inline constexpr eosio::name PENDING   = "pending"_n;
  inline constexpr eosio::name COMPLETED = "completed"_n;
  inline constexpr eosio::name DECLINED  = "declined"_n;
}

/**
 * @brief Заявка на материальную помощь доверенного/председателя КУ из его
 * персонального кошелька членских средств (w.brn.person).
 *
 * Доверенный сам подписывает заявление (statement) и сам платит НДФЛ с
 * полученной суммы — кооператив налог не удерживает (решение владельца
 * 2026-06-10). Средства резервно НЕ блокируются: при подтверждении кассиром
 * o.brn.aid (BURN с w.brn.person) сам упадёт, если баланса уже не хватает.
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash используется как outcome_hash в gateway и как process_hash
 * ledger2-операции.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: aids
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_aid {
  uint64_t           id;              ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;            ///< идентификатор заявки (= outcome_hash в gateway, = process_hash в ledger2)
  eosio::name        username;        ///< доверенный/председатель КУ — получатель помощи
  eosio::asset       amount;          ///< сумма выплаты
  eosio::name        status = BranchAidStatus::PENDING;  ///< см. BranchAidStatus
  document2          statement;       ///< заявление получателя (его подпись)
  std::string        decline_reason;  ///< заполняется только при status == declined

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
  uint64_t by_username() const { return username.value; }
};

typedef eosio::multi_index<
    "aids"_n, branch_aid,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_aid, eosio::checksum256, &branch_aid::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<branch_aid, uint64_t, &branch_aid::by_username>>>
    branch_aids_index;
