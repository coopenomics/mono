#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Приложение к договору УХД преподавателя на курс — ожидает второй
 * подписи председателя.
 *
 * scope = coopname; primary_key = id; уникальность документа — `byhash` на
 * `annex_hash`. Запись живёт только между подписью преподавателя (`signannex`)
 * и решением председателя: `apprvannex` фиксирует двухподписное приложение в
 * реестре документов и стирает запись, `dclineannex` стирает без публикации.
 * Действующие приложения контракт не хранит — их ведёт приложение
 * кооператива по журналу действий.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_annex {
  uint64_t id;                       ///< внутренний ID
  eosio::name username;              ///< пайщик-преподаватель
  uint64_t course_id;                ///< курс (числовой идентификатор курса в приложении)
  checksum256 contract_hash;         ///< договор УХД, к которому приложение
  checksum256 annex_hash;            ///< hash Приложения
  eosio::time_point_sec created_at;  ///< подпись преподавателя

  uint64_t primary_key()  const { return id; }
  checksum256 by_hash()   const { return annex_hash; }
  uint64_t by_username()  const { return username.value; }
};

typedef eosio::multi_index<
    "eduannexes"_n, edu_annex,
    eosio::indexed_by<"byhash"_n,     eosio::const_mem_fun<edu_annex, checksum256, &edu_annex::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<edu_annex, uint64_t,    &edu_annex::by_username>>>
    edu_annexes_index;

} // namespace Edubridge
