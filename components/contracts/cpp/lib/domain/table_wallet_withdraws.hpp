#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

namespace WalletTables {

using namespace eosio;

/**
 * @ingroup public_tables
 * @par table: withdraws
 */
struct [[eosio::table, eosio::contract(WALLET)]] withdraw {
  uint64_t id;
  name username;
  name coopname;
  checksum256 withdraw_hash;
  name status;

  asset quantity;
  document2 statement;
  document2 approved_statement;
  document2 authorization;

  eosio::time_point_sec created_at = current_time_point();

  uint64_t primary_key() const { return id; }
  checksum256 by_hash() const { return withdraw_hash; }
  uint64_t by_username() const { return username.value; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
};

typedef multi_index<
    "withdraws"_n, withdraw,
    indexed_by<"byusername"_n, const_mem_fun<withdraw, uint64_t, &withdraw::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<withdraw, checksum256, &withdraw::by_hash>>,
    indexed_by<"bystatus"_n, const_mem_fun<withdraw, uint64_t, &withdraw::by_status>>,
    indexed_by<"bycreated"_n, const_mem_fun<withdraw, uint64_t, &withdraw::by_created>>>
    withdraws_index;

} // namespace WalletTables

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(WalletTables::withdraw, cooperative);
