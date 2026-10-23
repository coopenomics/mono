#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/utils.hpp"
#include "document_core.hpp"

/**
 * @ingroup public_tables
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] cooperative {
  eosio::name username;
  eosio::name parent_username;

  std::string announce;
  std::string description;
  bool is_cooperative = false;

  bool is_branched = false;
  bool is_enrolled = false;

  eosio::name coop_type;

  eosio::asset registration;
  eosio::asset initial;
  eosio::asset minimum;

  eosio::binary_extension<eosio::asset> org_registration;
  eosio::binary_extension<eosio::asset> org_initial;
  eosio::binary_extension<eosio::asset> org_minimum;

  eosio::binary_extension<eosio::name> status;
  eosio::binary_extension<eosio::time_point_sec> created_at;
  eosio::binary_extension<document> document;

  uint64_t primary_key() const { return username.value; }

  void check_symbol_or_fail(eosio::asset contribution) {
    eosio::check(initial.symbol == contribution.symbol && minimum.symbol == contribution.symbol,
                 "Неверный контракт токена");
  }

  uint64_t by_status() const { return status.has_value() ? status.value().value : 0; }

  uint64_t by_created() const {
    return created_at.has_value() ? created_at.value().sec_since_epoch() : 0;
  }

  uint64_t by_parent() const { return parent_username.value; }

  uint128_t by_coop_childs() const { return combine_ids(username.value, parent_username.value); }

  uint64_t is_coop_index() const { return is_cooperative == true ? 1 : 0; }

  uint64_t bycooptype() const { return coop_type.value; }

  bool is_coop() const { return is_cooperative; }
};

typedef eosio::multi_index<
    "orgs"_n, cooperative,
    eosio::indexed_by<"iscoop"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::is_coop_index>>,
    eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::by_parent>>,
    eosio::indexed_by<"bycoopchilds"_n,
                     eosio::const_mem_fun<cooperative, uint128_t, &cooperative::by_coop_childs>>,
    eosio::indexed_by<"bycooptype"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::bycooptype>>>
    cooperatives_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(cooperative, contract);
