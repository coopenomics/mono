#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Материалы преподавателя по занятию — анкер процесса p.edu.rid от
 * приёма на ответственное хранение до паевого взноса результатом
 * интеллектуальной деятельности (РИД).
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `rid_hash` — этот hash используется как `process_hash` в ledger2-операции
 * приёма (o.edu.rid) и в документах процесса (заявление, протокол, акт).
 *
 * Запись заводит `holdrid` в момент приёма материалов на ответственное
 * хранение. Пока `hold_until` в будущем, идёт гарантийный срок курса и
 * `statement_hash` пуст: заявление в совет уходит после срока (`submitrid`).
 * Статус не хранится — фазу видно по заполненности `statement_hash` и по
 * сроку. `acceptrid` (приём по протоколу и акту), `declinerid` (отказ по
 * протоколу) и `recallrid` (рекламация) стирают запись, история остаётся
 * у парсера.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_rid {
  uint64_t id;                       ///< внутренний ID
  checksum256 rid_hash;              ///< process_hash для p.edu.rid
  eosio::name username;              ///< пайщик-преподаватель
  uint64_t assignment_id;            ///< задание/курс приложения, к которому относится РИД (off-chain id)
  eosio::asset amount;               ///< оценка РИД — сумма паевого взноса
  eosio::name rid_type;              ///< вид РИД (методика, курс, материалы и т.п.; словарь ведёт приложение)
  checksum256 statement_hash;        ///< hash Заявления о паевом взносе РИД; пустой, пока идёт гарантийный срок
  checksum256 storage_act_hash;      ///< hash Акта передачи материалов на ответственное хранение (3012)
  eosio::time_point_sec hold_until;  ///< до какой даты материалы числятся на ответственном хранении (гарантийный срок курса)
  eosio::time_point_sec created_at;  ///< приём материалов на хранение

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
