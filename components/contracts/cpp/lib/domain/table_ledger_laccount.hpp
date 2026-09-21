#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger_tables
 * @par table: accounts (ledger)
 */
struct [[eosio::table, eosio::contract(LEDGER)]] laccount {
  uint64_t id;
  std::string name;
  eosio::asset available;
  eosio::asset blocked;
  eosio::asset writeoff;

  uint64_t primary_key() const { return id; }

  bool is_empty() const {
    return available.amount == 0 && blocked.amount == 0 && writeoff.amount == 0;
  }

  eosio::asset get_total() const { return available + blocked + writeoff; }

  eosio::asset get_balance() const { return available + blocked; }
};

typedef eosio::multi_index<"accounts"_n, laccount> laccounts_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(laccount, contract);
