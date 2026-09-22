#pragma once


#include "../core/ram_payer.hpp"
#include <optional>

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"
#include "table_registrator_coops.hpp"

namespace Registrator {

using namespace eosio;

struct [[eosio::table, eosio::contract(REGISTRATOR)]] candidate {
  name username;
  name coopname;
  name braname;
  name status;
  time_point_sec created_at;
  document2 statement;
  checksum256 registration_hash;
  asset initial;
  asset minimum;

  uint64_t primary_key() const { return username.value; }
  checksum256 by_hash() const { return registration_hash; }
};

typedef multi_index<
    "candidates2"_n, candidate,
    indexed_by<"byhash"_n, const_mem_fun<candidate, checksum256, &candidate::by_hash>>>
    candidates_index;

inline std::optional<candidate> get_candidate_by_hash(name coopname, const checksum256 &hash) {
  candidates_index primary_index(_registrator, coopname.value);
  auto secondary_index = primary_index.get_index<"byhash"_n>();

  auto itr = secondary_index.find(hash);
  if (itr == secondary_index.end()) {
    return std::nullopt;
  }

  return *itr;
}

inline uint64_t get_active_participants_count(name coopname) {
  cooperatives2_index cooperatives(_registrator, _registrator.value);
  auto coop_itr = cooperatives.find(coopname.value);

  if (coop_itr == cooperatives.end() || !coop_itr->is_cooperative ||
      !coop_itr->active_participants_count.has_value()) {
    eosio::check(false, "Счетчик пайщиков кооператива не найден");
  }

  return coop_itr->active_participants_count.value();
}

} // namespace Registrator

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Registrator::candidate, cooperative);
