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
 * id — со смещением *1000: 51 → 51000, 80 → 80000, 86 → 86000.
 *
 * account_type определяется планом счетов LEDGER2_ACCOUNT_MAP и сохраняется
 * в записи при первой проводке:
 *   - 0 = ACTIVE          → balance = debit_balance − credit_balance
 *   - 1 = PASSIVE         → balance = credit_balance − debit_balance
 *   - 2 = ACTIVE_PASSIVE  → balance = debit_balance − credit_balance (знаковая)
 *
 * Хранятся одновременно ОБОРОТЫ (debit_balance, credit_balance) и САЛЬДО
 * (balance) — чтобы и сверка инварианта Σ Dr == Σ Cr была доступна, и
 * текущее сальдо счёта читалось без вычислений на стороне читателя.
 *
 * `balance` обновляется атомарно вместе с debit_balance / credit_balance в
 * actions `debit` / `credit` контракта ledger2.
 */
struct [[eosio::table, eosio::contract(LEDGER2)]] account2 {
  uint64_t     id;
  std::string  name;
  uint8_t      account_type;   ///< AccountType: 0=ACTIVE, 1=PASSIVE, 2=ACTIVE_PASSIVE
  eosio::asset debit_balance;
  eosio::asset credit_balance;
  eosio::asset balance;        ///< Текущее сальдо счёта (с учётом типа)

  uint64_t primary_key() const { return id; }

  bool is_empty() const {
    return debit_balance.amount == 0 && credit_balance.amount == 0;
  }

  /**
   * @brief Пересчёт сальдо по обороту с учётом активности/пассивности счёта.
   *
   * Вызывается из actions debit/credit после изменения оборотов.
   */
  static eosio::asset compute_balance(uint8_t type,
                                       const eosio::asset& dr,
                                       const eosio::asset& cr) {
    // 1 == PASSIVE — кредитовый остаток; для ACTIVE и ACTIVE_PASSIVE возвращаем Dr − Cr
    if (type == 1) return cr - dr;
    return dr - cr;
  }
};

typedef eosio::multi_index<"accounts"_n, account2> accounts2_index;
