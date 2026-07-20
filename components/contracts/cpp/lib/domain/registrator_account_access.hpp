#pragma once

#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "table_registrator_accounts.hpp"

account get_account_or_fail(eosio::name username) {
  accounts_index accounts(_registrator, _registrator.value);
  auto account_row = accounts.find(username.value);
  eosio::check(account_row != accounts.end(), "Аккаунт не найден");

  return *account_row;
}

// Возврат аккаунта к состоянию «можно подать заявку заново»: снимаем карточку
// участника (type) и сторейджи, которые проставил reguser. Сам аккаунт (username,
// ключи) сохраняется — повторная подача идёт на том же аккаунте. Вызывается при
// терминальном закрытии кандидата (отказ совета + возврат взноса): после этого
// reguser снова проходит проверку type=="" и принимает новое заявление.
inline void reset_account_card(eosio::name username) {
  accounts_index accounts(_registrator, _registrator.value);
  auto account_row = accounts.find(username.value);
  if (account_row == accounts.end()) return;
  accounts.modify(account_row, _registrator, [&](auto &a) {
    a.type = ""_n;
    a.storages.clear();
  });
}
