#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <optional>
#include <string>

#include "../../consts.hpp"
#include "../actions.hpp"
#include "../names.hpp"
#include "collateral.hpp"
#include "memo.hpp"

using namespace eosio;
using std::string;

/**
 * @file debt.hpp
 * @brief Общий слой контракта `debt` для других контрактов (задача 99D-16:
 * чужие таблицы — только через shared lib).
 *
 * Приложение, которое выдаёт заём своими средствами (Генерация в `capital`),
 * регистрирует его здесь при выдаче и сообщает о погашении — так все займы
 * кооператива видны в одном реестре.
 */
#define REGLOAN_SIGNATURE name coopname, name username, checksum256 debt_hash, checksum256 source_ref, asset amount, time_point_sec due_at, document2 statement, document2 contract
#define SETTLELOAN_SIGNATURE name coopname, checksum256 debt_hash, asset amount
#define WROFFLOAN_SIGNATURE name coopname, checksum256 debt_hash

using regloan_interface = void(REGLOAN_SIGNATURE);
using settleloan_interface = void(SETTLELOAN_SIGNATURE);
using wroffloan_interface = void(WROFFLOAN_SIGNATURE);

namespace Debt {

inline std::optional<debt> get_debt(name coopname, const checksum256 &debt_hash) {
  debts_index debts(_debt, coopname.value);
  auto by_hash = debts.get_index<"bydebthash"_n>();
  auto it = by_hash.find(debt_hash);
  if (it == by_hash.end())
    return std::nullopt;
  return *it;
}

inline std::optional<summary> get_summary(name coopname, name username) {
  summaries_index summaries(_debt, coopname.value);
  auto it = summaries.find(username.value);
  if (it == summaries.end())
    return std::nullopt;
  return *it;
}

/// Есть ли у пайщика заём в просрочке — для контрактов, которые отказывают в новых обязательствах.
inline bool has_overdue_loans(name coopname, name username) {
  debts_index debts(_debt, coopname.value);
  auto by_user = debts.get_index<"byusername"_n>();
  for (auto it = by_user.lower_bound(username.value); it != by_user.end() && it->username == username; ++it) {
    if (it->status == Status::OVERDUE) return true;
  }
  return false;
}

inline void assert_no_overdue_loans(name coopname, name username) {
  eosio::check(!has_overdue_loans(coopname, username), "У пайщика есть просроченные беспроцентные займы");
}

/// Есть ли у пайщика открытый заём любого источника — выход из кооператива держится до закрытия.
inline bool has_open_loans(name coopname, name username) {
  debts_index debts(_debt, coopname.value);
  auto by_user = debts.get_index<"byusername"_n>();
  auto it = by_user.lower_bound(username.value);
  return it != by_user.end() && it->username == username;
}

inline void check_member_can_exit(name coopname, name username) {
  eosio::check(!has_open_loans(coopname, username),
               "Выход невозможен: у пайщика есть незакрытый беспроцентный заём");
}

/// Регистрация займа, выданного другим приложением, в общем реестре.
inline void register_loan(name calling_contract, REGLOAN_SIGNATURE) {
  Action::send<regloan_interface>(_debt, Names::Debt::REGISTER_LOAN, calling_contract, coopname, username,
                                   debt_hash, source_ref, amount, due_at, statement, contract);
}

/// Погашение зарегистрированного займа на сумму (целиком или частью).
inline void settle_loan(name calling_contract, SETTLELOAN_SIGNATURE) {
  Action::send<settleloan_interface>(_debt, Names::Debt::SETTLE_LOAN, calling_contract, coopname, debt_hash, amount);
}

/// Закрытие зарегистрированного займа без денег (обращение обеспечения источником).
inline void writeoff_loan(name calling_contract, WROFFLOAN_SIGNATURE) {
  Action::send<wroffloan_interface>(_debt, Names::Debt::WRITEOFF_LOAN, calling_contract, coopname, debt_hash);
}

} // namespace Debt
