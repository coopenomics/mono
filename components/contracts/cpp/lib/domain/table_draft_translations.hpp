#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/contract.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_draft_tables
 * @par scope: scope (кооператив или _draft)
 * @par table: translations
 */
struct [[eosio::table, eosio::contract(DRAFT)]] translation {
  uint64_t id;
  uint64_t draft_id;
  eosio::name lang;
  std::string data;

  uint64_t primary_key() const { return id; }
  uint64_t by_draft() const { return draft_id; }

  uint128_t by_draft_lang() const { return combine_ids(draft_id, lang.value); }
};

typedef eosio::multi_index<
    "translations"_n, translation,
    eosio::indexed_by<"bydraft"_n, eosio::const_mem_fun<translation, uint64_t, &translation::by_draft>>,
    eosio::indexed_by<"bydraftlang"_n,
                      eosio::const_mem_fun<translation, uint128_t, &translation::by_draft_lang>>>
    translations_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(translation, system);
