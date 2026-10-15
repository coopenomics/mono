#pragma once


#include "../core/ram_payer.hpp"
#include <algorithm>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <utility>
#include <vector>

#include "../consts.hpp"
#include "document_core.hpp"

using namespace eosio;

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: decisions
 */
struct [[eosio::table, eosio::contract(SOVIET)]] decision {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;

  eosio::name type;
  uint64_t batch_id;
  document2 statement;

  std::vector<eosio::name> votes_for;
  std::vector<eosio::name> votes_against;

  bool validated = false;
  bool approved = false;
  bool authorized = false;
  eosio::name authorized_by;
  document2 authorization;

  eosio::time_point_sec created_at;

  eosio::binary_extension<eosio::time_point_sec> expired_at;
  eosio::binary_extension<std::string> meta;

  eosio::binary_extension<name> callback_contract;
  eosio::binary_extension<name> confirm_callback;
  eosio::binary_extension<name> decline_callback;
  eosio::binary_extension<checksum256> hash;

  uint64_t primary_key() const { return id; }

  uint64_t by_secondary() const { return batch_id; }

  uint64_t bytype() const { return type.value; }

  uint64_t byapproved() const { return approved; }

  uint64_t byvalidated() const { return validated; }

  uint64_t byauthorized() const { return authorized; }

  checksum256 byhash() const { return hash.value(); }

  void check_for_any_vote_exist(eosio::name member) const {
    eosio::check(std::find(votes_for.begin(), votes_for.end(), member) == votes_for.end(),
                 "Участник уже голосовал за данное решение.");

    eosio::check(std::find(votes_against.begin(), votes_against.end(), member) == votes_against.end(),
                 "Участник уже голосовал против данного решения.");
  }

  std::pair<uint64_t, uint64_t> get_votes_count() const {
    return std::make_pair(votes_for.size(), votes_against.size());
  }
};

typedef eosio::multi_index<
    "decisions"_n, decision,
    eosio::indexed_by<"bysecondary"_n, eosio::const_mem_fun<decision, uint64_t, &decision::by_secondary>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<decision, uint64_t, &decision::bytype>>,
    eosio::indexed_by<"byapproved"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byapproved>>,
    eosio::indexed_by<"byvalidated"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byvalidated>>,
    eosio::indexed_by<"byauthorized"_n, eosio::const_mem_fun<decision, uint64_t, &decision::byauthorized>>,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<decision, checksum256, &decision::byhash>>>
    decisions_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(decision, cooperative);
