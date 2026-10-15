#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

struct simple_wallet {
  eosio::asset available;
  eosio::asset withdrawed;
};

/**
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: coopwallet
 */
struct [[eosio::table, eosio::contract(FUND)]] coopwallet {
  uint64_t id = 0;

  eosio::name coopname;

  simple_wallet circulating_account;

  simple_wallet initial_account;

  simple_wallet accumulative_account;

  simple_wallet accumulative_expense_account;

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"coopwallet"_n, coopwallet> coopwallet_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(coopwallet, contract);
