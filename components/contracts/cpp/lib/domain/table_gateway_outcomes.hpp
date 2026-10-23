#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <optional>
#include <string>

#include "../consts.hpp"

namespace Gateway {

/**
 * @ingroup public_tables
 * @ingroup public_gateway_tables
 * @par table: outcomes
 */
struct [[eosio::table, eosio::contract(GATEWAY)]] outcome {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;
  eosio::name type;
  checksum256 outcome_hash;
  eosio::name callback_contract;
  eosio::name confirm_callback;
  eosio::name decline_callback;

  eosio::asset quantity;
  eosio::name status;

  eosio::time_point_sec created_at = current_time_point();

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  checksum256 by_hash() const { return outcome_hash; }
  uint64_t by_status() const { return status.value; }
};

typedef eosio::multi_index<
    "outcomes"_n, outcome,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<outcome, checksum256, &outcome::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<outcome, uint64_t, &outcome::by_username>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<outcome, uint64_t, &outcome::by_status>>>
    outcomes_index;

inline std::optional<outcome> get_outcome(eosio::name coopname, const checksum256 &hash) {
  outcomes_index primary_index(_gateway, coopname.value);
  auto secondary_index = primary_index.get_index<"byhash"_n>();

  auto itr = secondary_index.find(hash);
  if (itr == secondary_index.end()) {
    return std::nullopt;
  }

  return *itr;
}

} // namespace Gateway

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Gateway::outcome, cooperative);
