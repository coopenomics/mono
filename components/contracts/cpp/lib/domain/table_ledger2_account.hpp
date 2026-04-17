#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_ledger2_tables
 * @par table: accounts (ledger2)
 *
 * @brief Бухгалтерский счёт ledger2 (двойная запись).
 *
 * id — со смещением *1000: 86 → 86000, 86.01 → 861000, 86.0100 → 8610000.
 *
 * account_type определяется планом счетов и сохраняется в записи при первой
 * проводке:
 *   - 0 = ACTIVE          → balance = debit_balance − credit_balance
 *   - 1 = PASSIVE         → balance = credit_balance − debit_balance
 *   - 2 = ACTIVE_PASSIVE  → balance = debit_balance − credit_balance (знаковая)
 *
 * debit_balance / credit_balance накапливают обороты независимо. Это нужно
 * для сверки инварианта Σ debit == Σ credit по всему журналу (инвариант
 * двойной записи). Сальдо считается в get_balance() с учётом типа.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] account2 {
  uint64_t     id;
  std::string  name;
  uint8_t      account_type;   ///< AccountType: 0=ACTIVE, 1=PASSIVE, 2=ACTIVE_PASSIVE
  eosio::asset debit_balance;
  eosio::asset credit_balance;

  uint64_t primary_key() const { return id; }

  bool is_empty() const {
    return debit_balance.amount == 0 && credit_balance.amount == 0;
  }

  /// @brief Сальдо с учётом активности/пассивности счёта.
  eosio::asset get_balance() const {
    // 1 == PASSIVE — кредитовый остаток; для всех остальных типов возвращаем Dr − Cr
    if (account_type == 1) return credit_balance - debit_balance;
    return debit_balance - credit_balance;
  }
};

typedef eosio::multi_index<"accounts"_n, account2> accounts2_index;
