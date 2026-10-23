#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <vector>

#include "../consts.hpp"
#include "../core/utils.hpp"
#include "document_core.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: agreements3
 */
struct [[eosio::table, eosio::contract(SOVIET)]] agreement2 {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;
  eosio::name type;
  uint64_t program_id;
  uint64_t draft_id;
  uint64_t version;
  document2 document;
  eosio::name status;
  eosio::time_point_sec updated_at;
  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_status() const { return coopname.value; }
  uint64_t by_draft() const { return draft_id; }

  uint128_t by_user_and_draft() const { return combine_ids(username.value, draft_id); }
};

typedef eosio::multi_index<
    "agreements3"_n, agreement2,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<agreement2, uint64_t, &agreement2::by_username>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<agreement2, uint64_t, &agreement2::by_status>>,
    eosio::indexed_by<"bydraft"_n, eosio::const_mem_fun<agreement2, uint64_t, &agreement2::by_draft>>,
    eosio::indexed_by<"byuserdraft"_n, eosio::const_mem_fun<agreement2, uint128_t, &agreement2::by_user_and_draft>>>
    agreements2_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(agreement2, contract);
