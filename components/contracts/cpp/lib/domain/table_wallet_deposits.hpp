#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

namespace WalletTables {

using namespace eosio;

/**
 * @ingroup public_tables
 * @par table: deposits
 */
struct [[eosio::table, eosio::contract(WALLET)]] deposit {
  uint64_t id;
  name coopname;
  name username;
  checksum256 deposit_hash;

  asset quantity;
  name status;

  time_point_sec created_at = current_time_point();

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  checksum256 by_hash() const { return deposit_hash; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
};

typedef multi_index<
    "deposits"_n, deposit,
    indexed_by<"byhash"_n, const_mem_fun<deposit, checksum256, &deposit::by_hash>>,
    indexed_by<"byusername"_n, const_mem_fun<deposit, uint64_t, &deposit::by_username>>,
    indexed_by<"bystatus"_n, const_mem_fun<deposit, uint64_t, &deposit::by_status>>,
    indexed_by<"bycreated"_n, const_mem_fun<deposit, uint64_t, &deposit::by_created>>>
    deposits_index;

} // namespace WalletTables

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(WalletTables::deposit, cooperative);
