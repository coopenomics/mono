#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

namespace Registrator {

using namespace eosio;

struct [[eosio::table, eosio::contract(REGISTRATOR)]] candidate_legacy {
  name username;
  name coopname;
  name braname;
  name status;
  time_point_sec created_at;
  document statement;
  checksum256 registration_hash;
  asset initial;
  asset minimum;

  uint64_t primary_key() const { return username.value; }
  checksum256 by_hash() const { return registration_hash; }
};

typedef multi_index<
    "candidates"_n, candidate_legacy,
    indexed_by<"byhash"_n, const_mem_fun<candidate_legacy, checksum256, &candidate_legacy::by_hash>>>
    candidates_legacy_index;

} // namespace Registrator

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Registrator::candidate_legacy, cooperative);
