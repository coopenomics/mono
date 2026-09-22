#pragma once

#include <eosio/eosio.hpp>

#include "../core/utils.hpp"
#include "../core/ram_payer.hpp"

struct counts_base {
  eosio::name key;
  eosio::name secondary_key;
  uint64_t value;

  uint64_t primary_key() const { return key.value; }
  uint128_t keyskey() const { return combine_ids(key.value, secondary_key.value); }
  uint128_t keyvalue() const { return combine_ids(key.value, value); }
};

typedef eosio::multi_index<
    "counts"_n, counts_base,
    eosio::indexed_by<"keyskey"_n, eosio::const_mem_fun<counts_base, uint128_t, &counts_base::keyskey>>>
    counts_index;

// Счётчики идентификаторов — служебное хранение: платит контракт-владелец.
RAM_PAYER_CLASS(counts_base, contract);

uint64_t get_id(eosio::name code, eosio::name scope, eosio::name key) {
  counts_index counts(code, scope.value);
  auto count = counts.find(key.value);
  uint64_t id = 1;

  if (count == counts.end()) {
    counts.emplace(RamPayer::of(counts), [&](auto &c) {
      c.key = key;
      c.value = id;
    });
  } else {
    id = count->value + 1;
    counts.modify(count, RamPayer::of(counts), [&](auto &c) { c.value = id; });
  }

  return id;
}

uint64_t get_global_id(eosio::name _me, eosio::name key) {
  counts_index counts(_me, _me.value);
  auto count = counts.find(key.value);
  uint64_t id = 1;

  if (count == counts.end()) {
    counts.emplace(RamPayer::of(counts), [&](auto &c) {
      c.key = key;
      c.value = id;
    });
  } else {
    id = count->value + 1;
    counts.modify(count, RamPayer::of(counts), [&](auto &c) { c.value = id; });
  }

  return id;
}

uint64_t get_global_id_in_scope(eosio::name _me, eosio::name scope, eosio::name key) {
  counts_index counts(_me, scope.value);
  auto count = counts.find(key.value);
  uint64_t id = 1;

  if (count == counts.end()) {
    counts.emplace(RamPayer::of(counts), [&](auto &c) {
      c.key = key;
      c.value = id;
    });
  } else {
    id = count->value + 1;
    counts.modify(count, RamPayer::of(counts), [&](auto &c) { c.value = id; });
  }

  return id;
}
