#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "document_core.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger_tables
 * @par table: writeoffs
 */
struct [[eosio::table, eosio::contract(LEDGER)]] writeoff_op {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;
  uint64_t account_id;
  eosio::asset quantity;
  std::string reason;
  document2 document;
  checksum256 writeoff_hash;
  eosio::name status;

  uint64_t primary_key() const { return id; }
  uint64_t by_coop() const { return coopname.value; }
  checksum256 by_hash() const { return writeoff_hash; }
};

typedef eosio::multi_index<
    "writeoffs"_n, writeoff_op,
    eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<writeoff_op, uint64_t, &writeoff_op::by_coop>>,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<writeoff_op, checksum256, &writeoff_op::by_hash>>>
    writeoffs_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(writeoff_op, cooperative);
