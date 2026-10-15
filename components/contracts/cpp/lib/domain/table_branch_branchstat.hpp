#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: branchstat
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branchstat {
  eosio::name coopname;
  uint64_t count;

  uint64_t primary_key() const { return coopname.value; }
};

typedef eosio::multi_index<"branchstat"_n, branchstat> branchstat_index;

uint64_t add_branch_count(eosio::name coopname) {
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);

  uint64_t new_count = 0;

  if (st == stat.end()) {
    new_count = 1;
    stat.emplace(RamPayer::of(stat, coopname), [&](auto &s) {
      s.coopname = coopname;
      s.count = new_count;
    });
  } else {
    new_count = st->count + 1;
    stat.modify(st, RamPayer::of(stat, coopname), [&](auto &s) { s.count += 1; });
  }

  return new_count;
}

uint64_t sub_branch_count(eosio::name coopname) {
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);
  uint64_t new_count = 0;

  eosio::check(st != stat.end(), "Нет кооперативных участков");
  eosio::check(st->count > 0, "Системная ошибка");

  new_count = st->count - 1;

  stat.modify(st, RamPayer::of(stat, coopname), [&](auto &s) { s.count -= 1; });

  return new_count;
}

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(branchstat, contract);
