#pragma once

#include <algorithm>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>
#include <vector>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: branches
 */
struct [[eosio::table, eosio::contract(BRANCH)]] coobranch {
  eosio::name braname;
  eosio::name trustee;
  std::vector<eosio::name> trusted;

  // Поля приватности добавлены как binary_extension: у действующих кооперативов
  // в таблице уже могут быть строки, и расширение в конце struct сохраняет
  // обратную совместимость десериализации (старые записи читаются как публичные с пустым списком).
  eosio::binary_extension<bool> is_private;                  // приватный участок: выбрать его могут только из белого списка
  eosio::binary_extension<std::vector<eosio::name>> whitelist; // белый список аккаунтов, допущенных к выбору приватного участка

  uint64_t primary_key() const { return braname.value; }
  uint64_t by_trustee() const { return trustee.value; }

  void add_account_to_trusted(const eosio::name &account) { trusted.push_back(account); }

  void remove_account_from_trusted(const eosio::name &account) {
    auto itr = std::remove(trusted.begin(), trusted.end(), account);
    eosio::check(itr != trusted.end(), "Account not found in trusted list");
    trusted.erase(itr, trusted.end());
  }

  bool is_account_in_trusted(const eosio::name &account) const {
    return std::find(trusted.begin(), trusted.end(), account) != trusted.end();
  }

  bool is_user_authorized(const eosio::name &username) const {
    if (trustee == username) {
      return true;
    }
    return is_account_in_trusted(username);
  }

  // признак приватности с учётом отсутствующего расширения у старых записей
  // (const-перегрузка value_or() без аргумента возвращает bool() == false, если значения нет)
  bool is_branch_private() const { return is_private.value_or(); }

  bool is_account_in_whitelist(const eosio::name &account) const {
    if (!whitelist.has_value()) {
      return false;
    }
    const auto &wl = whitelist.value();
    return std::find(wl.begin(), wl.end(), account) != wl.end();
  }

  void set_private(bool value) { is_private.emplace(value); }

  void add_account_to_whitelist(const eosio::name &account) {
    if (!whitelist.has_value()) {
      whitelist.emplace();
    }
    auto &wl = whitelist.value();
    eosio::check(std::find(wl.begin(), wl.end(), account) == wl.end(),
                 "Аккаунт уже добавлен в белый список кооперативного участка");
    wl.push_back(account);
  }

  void remove_account_from_whitelist(const eosio::name &account) {
    eosio::check(whitelist.has_value(), "Белый список кооперативного участка пуст");
    auto &wl = whitelist.value();
    auto it = std::find(wl.begin(), wl.end(), account);
    eosio::check(it != wl.end(), "Аккаунт не найден в белом списке кооперативного участка");
    wl.erase(it);
  }
};

typedef eosio::multi_index<
    "branches"_n, coobranch,
    eosio::indexed_by<"bytrustee"_n, eosio::const_mem_fun<coobranch, uint64_t, &coobranch::by_trustee>>>
    branch_index;

coobranch get_branch_or_fail(eosio::name coopname, eosio::name braname) {
  branch_index branches(_branch, coopname.value);
  auto branch = branches.find(braname.value);

  eosio::check(branch != branches.end(), "Кооперативный Участок не найден");

  return *branch;
}
