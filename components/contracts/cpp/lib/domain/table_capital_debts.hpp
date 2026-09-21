#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

using namespace eosio;

struct [[eosio::table, eosio::contract(CAPITAL)]] debt {
  uint64_t id;
  eosio::name coopname;
  eosio::name username;
  eosio::name status = "created"_n;
  checksum256 debt_hash;
  checksum256 project_hash;
  time_point_sec repaid_at;
  asset amount;
  document2 statement;
  document2 approved_statement;
  document2 authorization;
  std::string memo;

  uint64_t primary_key() const { return id; }

  uint64_t by_username() const { return username.value; }
  checksum256 by_debt_hash() const { return debt_hash; }
  checksum256 by_project_hash() const { return project_hash; }
};

typedef eosio::multi_index<
    "debts"_n, debt,
    indexed_by<"byusername"_n, const_mem_fun<debt, uint64_t, &debt::by_username>>,
    indexed_by<"bydebthash"_n, const_mem_fun<debt, checksum256, &debt::by_debt_hash>>,
    indexed_by<"byprojhash"_n, const_mem_fun<debt, checksum256, &debt::by_project_hash>>>
    debts_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(debt, cooperative);
