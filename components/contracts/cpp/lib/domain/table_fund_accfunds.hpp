#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: accfunds
 */
struct [[eosio::table, eosio::contract(FUND)]] accfund {
  uint64_t id;
  eosio::name coopname;
  eosio::name contract;

  std::string name;
  std::string description;

  uint64_t percent;
  eosio::asset available;
  eosio::asset withdrawed;

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"accfunds"_n, accfund> accfunds_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(accfund, contract);
