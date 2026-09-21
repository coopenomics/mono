#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "table_registrator_verification.hpp"

/**
 * @ingroup public_tables
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] account {
  eosio::name username;
  eosio::name referer;
  eosio::name registrator;
  eosio::name type;
  eosio::name status;
  std::string meta;

  std::vector<eosio::name> storages;
  std::vector<verification> verifications;

  eosio::time_point_sec registered_at;

  uint64_t primary_key() const { return username.value; }

  uint64_t by_referer() const { return referer.value; }

  uint64_t by_type() const { return type.value; }

  uint64_t by_status() const { return status.value; }

  uint64_t by_registr() const { return registrator.value; }

  bool is_active() const { return status == "active"_n; }

  uint64_t by_registered_at() const { return registered_at.sec_since_epoch(); }

  bool is_verified() const {
    for (const auto &v : verifications) {
      if (v.is_verified) {
        return true;
      }
    }
    return false;
  }

  uint64_t is_verified_index() const {
    for (const auto &v : verifications) {
      if (v.is_verified) {
        return 1;
      }
    }
    return 0;
  }
};

typedef eosio::multi_index<
    "accounts"_n, account,
    eosio::indexed_by<"byreferer"_n, eosio::const_mem_fun<account, uint64_t, &account::by_referer>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<account, uint64_t, &account::by_type>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<account, uint64_t, &account::by_status>>,
    eosio::indexed_by<"byregistr"_n, eosio::const_mem_fun<account, uint64_t, &account::by_registr>>,
    eosio::indexed_by<"byregistred"_n, eosio::const_mem_fun<account, uint64_t, &account::by_registered_at>>,
    eosio::indexed_by<"byverif"_n, eosio::const_mem_fun<account, uint64_t, &account::is_verified_index>>>
    accounts_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(account, contract);
