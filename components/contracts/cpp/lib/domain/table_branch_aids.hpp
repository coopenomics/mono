#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/document.hpp"

/**
 * @brief Статусы заявления на материальную помощь.
 *
 * Наличие записи в таблице = заявление в работе. Финал любого рода (выплата,
 * отказ совета, отказ кассира) стирает запись — история остаётся в журнале
 * действий и в решении совета.
 */
namespace AidStatus {
inline constexpr eosio::name PROPOSED   = "proposed"_n;    ///< на рассмотрении совета
inline constexpr eosio::name AUTHORIZED = "authorized"_n;  ///< совет одобрил, ждёт выплаты кассиром
} // namespace AidStatus

/**
 * @brief Заявление на материальную помощь доверенного/председателя КУ из его
 * персонального кошелька членских средств (w.brn.person); requirement b6
 * «Экономика КУ», процесс p.brn.aid.
 *
 * Выплата денег из кооператива — компетенция совета, поэтому путь двухшаговый:
 * `createaid` вносит подписанное заявление на повестку совета
 * (soviet::createagenda, type=brnaid), и только после положительного решения
 * (`onaidauth`) регистрируется исходящий платёж в gateway — заявка попадает к
 * кассиру. Подтверждение кассира приходит callback'ом `branch::aidconfirm`
 * (там же применяются o.brn.aidtax и o.brn.aid), отказ — `branch::aiddecline`. Отказ совета
 * приходит callback'ом `onaiddecl` и закрывает заявление, не доводя его до
 * кассира.
 *
 * Средства резервно НЕ блокируются ни на одном шаге: при подтверждении
 * кассиром o.brn.aid (BURN с w.brn.person) сам упадёт, если баланса уже не
 * хватает (получатель успел перевести средства в «Стол заказов»).
 *
 * Доверенный сам подписывает заявление (statement). НДФЛ удерживает кооператив
 * как налоговый агент: `amount` — сумма заявления целиком, она списывается с
 * персонального кошелька, но получателю уходит остаток за вычетом налога, а
 * удержанное копится обязательством перед бюджетом (решение владельца
 * 2026-08-13, отменяет прежнее «налог платит получатель сам»).
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash используется как hash повестки совета, как outcome_hash в gateway
 * и как process_hash ledger2-операции.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: aids
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_aid {
  uint64_t           id;              ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;            ///< идентификатор заявления (= hash повестки совета, = outcome_hash в gateway, = process_hash в ledger2)
  eosio::name        username;        ///< доверенный/председатель КУ — получатель помощи
  eosio::name        braname;         ///< кооперативный участок, по которому распределены средства
  eosio::asset       amount;          ///< сумма заявления (брутто): списывается с кошелька целиком, получателю уходит за вычетом НДФЛ
  eosio::name        status;          ///< см. AidStatus
  document2          statement;       ///< заявление получателя (его подпись)
  document2          protocol;        ///< протокол совета о выплате (заполняется в onaidauth)

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_status() const { return status.value; }
};

typedef eosio::multi_index<
    "aids"_n, branch_aid,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_aid, eosio::checksum256, &branch_aid::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<branch_aid, uint64_t, &branch_aid::by_username>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<branch_aid, uint64_t, &branch_aid::by_status>>>
    branch_aids_index;
