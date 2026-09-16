#pragma once

#include <vector>

#include <eosio/eosio.hpp>

#include "../../consts.hpp"

/**
 * Таблицы регистратора — из domain/index.hpp (подключать раньше).
 */
namespace Core::Registrator {

inline account get_account_or_fail(eosio::name username) {
  accounts_index accounts(_registrator, _registrator.value);
  auto account_itr = accounts.find(username.value);
  eosio::check(account_itr != accounts.end(), "Аккаунт не найден");
  return *account_itr;
}

/// Имена всех кооперативов — для `migrate` и других обходов по кооперативам
/// без прямого чтения таблицы registrator из кода контракта (задача 99D-16).
inline std::vector<eosio::name> get_cooperative_names() {
  cooperatives2_index coops(_registrator, _registrator.value);
  std::vector<eosio::name> names;
  for (const auto& coop : coops) names.push_back(coop.username);
  return names;
}

} // namespace Core::Registrator
