#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"

struct right {
  eosio::name contract;
  eosio::name action_name;
};

/**
 * @ingroup public_tables
 * @ingroup public_soviet_tables
 * @par table: staff
 */
struct [[eosio::table, eosio::contract(SOVIET)]] staff {
  eosio::name username;
  std::string position_title;
  std::vector<eosio::name> roles;
  std::vector<right> rights;
  eosio::time_point_sec created_at;
  eosio::time_point_sec updated_at;

  uint64_t primary_key() const { return username.value; }

  bool has_right(eosio::name contract, eosio::name action_name) const {
    for (const auto &r : rights) {
      if (r.contract == contract && r.action_name == action_name) {
        return true;
      }
    }
    return false;
  }
};

typedef eosio::multi_index<"staff"_n, staff> staff_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(staff, contract);
