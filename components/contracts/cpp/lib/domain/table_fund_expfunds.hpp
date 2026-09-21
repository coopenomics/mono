#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: expfunds
 */
struct [[eosio::table, eosio::contract(FUND)]] expfund {
  uint64_t id;
  eosio::name coopname;
  eosio::name contract;

  std::string name;
  std::string description;

  eosio::asset expended;

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"expfunds"_n, expfund> expfunds_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(expfund, contract);
