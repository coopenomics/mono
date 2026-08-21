#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Заявление преподавателя о паевом взносе результатом интеллектуальной
 * деятельности (РИД) — анкер процесса p.edu.rid.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `rid_hash` — этот hash используется как `process_hash` в ledger2-операции
 * приёма (o.edu.rid) и в документах процесса (заявление, протокол, акт).
 *
 * Статус не хранится: запись живёт только в ожидании решения совета.
 * `acceptrid` (приём по протоколу и акту) и `declinerid` (отказ по протоколу)
 * стирают запись — история остаётся у парсера.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_rid {
  uint64_t id;                       ///< внутренний ID
  checksum256 rid_hash;              ///< process_hash для p.edu.rid
  eosio::name username;              ///< пайщик-преподаватель
  uint64_t assignment_id;            ///< задание/курс приложения, к которому относится РИД (off-chain id)
  eosio::asset amount;               ///< оценка РИД — сумма паевого взноса
  eosio::name rid_type;              ///< вид РИД (методика, курс, материалы и т.п.; словарь ведёт приложение)
  checksum256 statement_hash;        ///< hash Заявления о паевом взносе РИД
  eosio::time_point_sec created_at;  ///< подача заявления

  uint64_t primary_key()  const { return id; }
  checksum256 by_hash()   const { return rid_hash; }
  uint64_t by_username()  const { return username.value; }
};

typedef eosio::multi_index<
    "edurids"_n, edu_rid,
    eosio::indexed_by<"byhash"_n,     eosio::const_mem_fun<edu_rid, checksum256, &edu_rid::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<edu_rid, uint64_t,    &edu_rid::by_username>>>
    edu_rids_index;

} // namespace Edubridge
