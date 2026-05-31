#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

namespace Loan {

using namespace eosio;

struct [[eosio::table, eosio::contract(LOAN)]] debt {
  uint64_t id;
  name coopname;
  name username;
  checksum256 debt_hash;
  asset amount;
  time_point_sec created_at;
  time_point_sec repaid_at;

  // Контракт-источник, инициировавший выдачу займа (capital / marketplace / ...).
  // loan не знает доменного контекста (проекта, программы) — это ответственность
  // вызывающего контракта; ему же принадлежит и локальная привязка debt_hash.
  name source_contract;

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  checksum256 by_debt_hash() const { return debt_hash; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
  uint64_t by_repaid() const { return repaid_at.sec_since_epoch(); }
};

typedef multi_index<
    "debts"_n, debt,
    indexed_by<"byusername"_n, const_mem_fun<debt, uint64_t, &debt::by_username>>,
    indexed_by<"bydebthash"_n, const_mem_fun<debt, checksum256, &debt::by_debt_hash>>,
    indexed_by<"bycreated"_n, const_mem_fun<debt, uint64_t, &debt::by_created>>,
    indexed_by<"byrepaid"_n, const_mem_fun<debt, uint64_t, &debt::by_repaid>>>
    debts_index;

} // namespace Loan
