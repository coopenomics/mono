#pragma once

#include <optional>
#include <set>
#include <string>

#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "../actions.hpp"
#include "../programs.hpp"
#include "../soviet/soviet.hpp"

using namespace eosio;

#define COMPLETEWTHD_SIGNATURE name coopname, checksum256 withdraw_hash
#define DECLINEWTHD_SIGNATURE name coopname, checksum256 withdraw_hash, std::string reason

using completewthd_interface = void(COMPLETEWTHD_SIGNATURE);
using declinewthd_interface = void(DECLINEWTHD_SIGNATURE);

#define AUTHWTHD_SIGNATURE AUTHORIZE_CALLBACK_SIGNATURE
using authwthd_interface = void(AUTHWTHD_SIGNATURE);

static const std::set<eosio::name> wallet_callback_actions = {
    "authwthd"_n,
    "declinewthd"_n,
    "completewthd"_n,
};

class Wallet {
public:
  using deposit = WalletTables::deposit;
  using withdraw = WalletTables::withdraw;
  using deposits_index = WalletTables::deposits_index;
  using withdraws_index = WalletTables::withdraws_index;
  using program_agreement = WalletTables::program_agreement;
  using user = WalletTables::user;
  using users_index = WalletTables::users_index;

  static eosio::name get_valid_wallet_action(const eosio::name &action) {
    eosio::check(wallet_callback_actions.contains(action), "Недопустимое имя действия wallet");
    return action;
  }

  static void validate_asset(const eosio::asset &amount) {
    check(amount.symbol == _root_govern_symbol, "Неверный символ токена");
    check(amount.is_valid(), "Неверный актив");
    check(amount.amount >= 0, "Сумма должна быть неотрицательной");
  }

  static void add_available_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                                  eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));

    action(permission_level{contract, "active"_n}, _soviet, "addbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static void sub_available_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                                  eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));

    action(permission_level{contract, "active"_n}, _soviet, "subbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, false, memo))
        .send();
  }

  static void add_blocked_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                                eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));

    action(permission_level{contract, "active"_n}, _soviet, "addbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();

    action(permission_level{contract, "active"_n}, _soviet, "blockbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static void sub_blocked_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                                eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));
    print("▶ Уменьшаем заблокированные средства кошелька пользователя: ", amount, " для пользователя: ",
          username);
    print("▶ Программа: ", program_row.id);
    print("▶ Доступно: ", program_row.available->amount);
    print("▶ Заблокированные средства: ", program_row.blocked->amount);
    print("▶ Сумма для уменьшения: ", amount.amount);

    action(permission_level{contract, "active"_n}, _soviet, "unblockbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();

    action(permission_level{contract, "active"_n}, _soviet, "subbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, false, memo))
        .send();
  }

  static void block_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                          eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));

    action(permission_level{contract, "active"_n}, _soviet, "blockbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static void unblock_funds(eosio::name contract, eosio::name coopname, eosio::name username,
                            eosio::asset amount, eosio::name program_type, std::string memo) {
    auto program_row = get_program_or_fail(coopname, get_program_id(program_type));

    action(permission_level{contract, "active"_n}, _soviet, "unblockbal"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static void pay_membership_fee(name contract, name coopname, name username, eosio::asset amount,
                                 uint64_t program_id, std::string memo) {
    auto program_row = get_program_or_fail(coopname, program_id);

    action(permission_level{contract, "active"_n}, _soviet, "addmemberfee"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static void unpay_membership_fee(name contract, name coopname, name username, eosio::asset amount,
                                   uint64_t program_id, std::string memo) {
    auto program_row = get_program_or_fail(coopname, program_id);

    action(permission_level{contract, "active"_n}, _soviet, "submemberfee"_n,
           std::make_tuple(coopname, username, program_row.id, amount, memo))
        .send();
  }

  static std::optional<deposit> get_deposit(eosio::name coopname, const checksum256 &hash) {
    deposits_index primary_index(_wallet, coopname.value);
    auto secondary_index = primary_index.get_index<"byhash"_n>();

    auto itr = secondary_index.find(hash);
    if (itr == secondary_index.end()) {
      return std::nullopt;
    }

    return *itr;
  }

  static std::optional<withdraw> get_withdraw(eosio::name coopname, const checksum256 &hash) {
    withdraws_index primary_index(_wallet, coopname.value);
    auto secondary_index = primary_index.get_index<"byhash"_n>();

    auto itr = secondary_index.find(hash);
    if (itr == secondary_index.end()) {
      return std::nullopt;
    }

    return *itr;
  }
};
