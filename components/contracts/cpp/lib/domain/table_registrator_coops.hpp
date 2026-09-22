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
struct [[eosio::table, eosio::contract(REGISTRATOR)]] cooperative2 {
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
  eosio::binary_extension<document2> document;
  eosio::binary_extension<uint64_t> active_participants_count;

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
    "coops"_n, cooperative2,
    eosio::indexed_by<"iscoop"_n, eosio::const_mem_fun<cooperative2, uint64_t, &cooperative2::is_coop_index>>,
    eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<cooperative2, uint64_t, &cooperative2::by_parent>>,
    eosio::indexed_by<"bycoopchilds"_n,
                     eosio::const_mem_fun<cooperative2, uint128_t, &cooperative2::by_coop_childs>>,
    eosio::indexed_by<"bycooptype"_n, eosio::const_mem_fun<cooperative2, uint64_t, &cooperative2::bycooptype>>>
    cooperatives2_index;

cooperative2 get_cooperative_or_fail(eosio::name coopname) {
  cooperatives2_index coops(_registrator, _registrator.value);
  auto org = coops.find(coopname.value);
  eosio::check(org != coops.end(), "Организация не найдена");
  eosio::check(org->is_coop(), "Организация - не кооператив");
  eosio::check(org->status.value() == "active"_n, "Кооператив не активен");

  return *org;
}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(cooperative2, contract);
