#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "document_core.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: fwithdraws
 */
struct [[eosio::table, eosio::contract(FUND)]] fwithdraw {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;
  eosio::name status;
  eosio::name type;
  uint64_t fund_id;
  eosio::asset quantity;
  document2 document;
  std::string bank_data_id;
  eosio::time_point_sec expired_at;

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_status() const { return status.value; }

  uint64_t by_expired() const { return expired_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "fwithdraws"_n, fwithdraw,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<fwithdraw, uint64_t, &fwithdraw::by_username>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<fwithdraw, uint64_t, &fwithdraw::by_status>>,
    eosio::indexed_by<"byexpired"_n, eosio::const_mem_fun<fwithdraw, uint64_t, &fwithdraw::by_expired>>>
    fundwithdraws_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(fwithdraw, cooperative);
