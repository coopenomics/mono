#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <optional>
#include <string>

#include "../../consts.hpp"
#include "../actions.hpp"
#include "../names.hpp"

using namespace eosio;
using std::string;

#define CREATEDEBT_SIGNATURE name coopname, name username, checksum256 debt_hash, time_point_sec repaid_at, asset quantity
#define SETTLEDEBT_SIGNATURE name coopname, name username, checksum256 debt_hash, asset quantity

using createdebt_interface = void(CREATEDEBT_SIGNATURE);
using settledebt_interface = void(SETTLEDEBT_SIGNATURE);

namespace Loan {

inline std::optional<debt> get_debt(name coopname, const checksum256 &debt_hash) {
  debts_index debts(_loan, coopname.value);
  auto by_hash = debts.get_index<"bydebthash"_n>();
  auto it = by_hash.find(debt_hash);
  if (it == by_hash.end())
    return std::nullopt;
  return *it;
}

inline std::optional<summary> get_summary(name coopname, name username) {
  summaries_index summaries(_loan, coopname.value);
  auto it = summaries.find(username.value);
  if (it == summaries.end())
    return std::nullopt;
  return *it;
}

inline void assert_no_expired_debts(name coopname, name username) {
  debts_index debts(_loan, coopname.value);
  auto by_repaid = debts.get_index<"byrepaid"_n>();

  uint32_t now = time_point_sec(current_time_point()).sec_since_epoch();

  for (auto itr = by_repaid.begin(); itr != by_repaid.end() && itr->repaid_at.sec_since_epoch() <= now;
       ++itr) {
    if (itr->username == username) {
      eosio::check(false, "У пользователя есть просроченные долги");
    }
  }
}

inline void create_debt(name calling_contract, CREATEDEBT_SIGNATURE) {
  Action::send<createdebt_interface>(_loan, Names::Loan::CREATE_DEBT, calling_contract, coopname, username,
                                      debt_hash, repaid_at, quantity);
}

inline void settle_debt(name calling_contract, SETTLEDEBT_SIGNATURE) {
  Action::send<settledebt_interface>(_loan, Names::Loan::SETTLE_DEBT, calling_contract, coopname, username,
                                      debt_hash, quantity);
}

} // namespace Loan
