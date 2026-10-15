#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: programs
 */
struct [[eosio::table, eosio::contract(SOVIET)]] program {
  uint64_t id;
  uint64_t draft_id;
  eosio::name program_type;

  eosio::name coopname;
  bool is_active;
  std::string title;
  std::string announce;
  std::string description;
  std::string preview;
  std::string images;
  std::string meta;

  eosio::name calculation_type;
  uint64_t membership_percent_fee;
  eosio::asset fixed_membership_contribution;

  eosio::time_point_sec start_at;
  eosio::time_point_sec expired_at;

  eosio::binary_extension<eosio::asset> available;
  eosio::binary_extension<eosio::asset> spendeded;
  eosio::binary_extension<eosio::asset> blocked;

  eosio::binary_extension<bool> is_can_coop_spend_share_contributions;

  eosio::binary_extension<eosio::asset> share_contributions;
  eosio::binary_extension<eosio::asset> membership_contributions;

  uint64_t primary_key() const { return id; }
  uint64_t by_program_type() const { return program_type.value; }
  uint64_t by_draft() const { return draft_id; }
};

typedef eosio::multi_index<
    "programs"_n, program,
    eosio::indexed_by<"programtype"_n, eosio::const_mem_fun<program, uint64_t, &program::by_program_type>>,
    eosio::indexed_by<"bydraft"_n, eosio::const_mem_fun<program, uint64_t, &program::by_draft>>>
    programs_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(program, contract);
