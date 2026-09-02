#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Договор преподавателя об участии в хозяйственной деятельности (УХД)
 * по ЦПП «Образование» — анкер процесса p.edu.teach.
 *
 * scope = coopname; primary_key = id; один договор на преподавателя
 * (`byusername`), уникальность документа — `byhash` на `contract_hash`.
 *
 * Договор подписывают двое: преподаватель (первая подпись, `signcontract`) и
 * председатель совета от лица кооператива (вторая подпись со стола
 * председателя — «Запросы одобрений»). До второй подписи запись стоит в
 * `pending`; после `apprvcontr` — `active`, и только с активным договором
 * преподаватель подписывает приложения к нему и вносит паевой взнос РИД.
 * Отказ председателя (`dclinecontr`) стирает запись — преподаватель может
 * подписать договор заново.
 */
namespace ContractStatus {
  constexpr eosio::name PENDING = "pending"_n;  ///< ждёт подписи председателя
  constexpr eosio::name ACTIVE  = "active"_n;   ///< подписан обеими сторонами
}

struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_contract {
  uint64_t id;                        ///< внутренний ID
  eosio::name username;               ///< пайщик-преподаватель
  checksum256 contract_hash;          ///< hash Договора УХД — process_hash для p.edu.teach
  eosio::name status;                 ///< ContractStatus
  eosio::time_point_sec created_at;   ///< подпись преподавателя
  eosio::time_point_sec approved_at;  ///< подпись председателя (нулевое время в pending)

  uint64_t primary_key()  const { return id; }
  uint64_t by_username()  const { return username.value; }
  checksum256 by_hash()   const { return contract_hash; }
};

typedef eosio::multi_index<
    "educontracts"_n, edu_contract,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<edu_contract, uint64_t,    &edu_contract::by_username>>,
    eosio::indexed_by<"byhash"_n,     eosio::const_mem_fun<edu_contract, checksum256, &edu_contract::by_hash>>>
    edu_contracts_index;

} // namespace Edubridge
