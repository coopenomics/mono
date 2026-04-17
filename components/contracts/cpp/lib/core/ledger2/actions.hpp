#pragma once

#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

#include "accounts.hpp"
#include "wallets.hpp"

/**
 * @brief Именованные операции ledger2 (action codes).
 *
 * Реестр — строго хардкод. Любая новая операция требует релиза
 * контракта, менять на лету нельзя. На один action_code приходится
 * ровно одна запись в ACTION_REGISTRY и атомарно одно движение
 * кошелька + одна пара проводок.
 *
 * @ingroup public_ledger2_consts
 */
namespace ledger2_ops {
  inline constexpr eosio::name ENTRANCE_FEE     = "entrancefee"_n;
  inline constexpr eosio::name INITIAL_SHARE    = "initshare"_n;
  inline constexpr eosio::name DEPOSIT_COMPLETE = "depositcpl"_n;
  inline constexpr eosio::name WITHDRAW_COMPLETE= "withdrawcpl"_n;
  inline constexpr eosio::name CAPITAL_IMPORT   = "capimport"_n;
  inline constexpr eosio::name LOAN_REPAYMENT   = "loanrepay"_n;
  inline constexpr eosio::name ACT2_SHARE       = "act2share"_n;
  inline constexpr eosio::name ACT2_LOAN        = "act2loan"_n;
  inline constexpr eosio::name SUPPLY_CONFIRM   = "supplycnf"_n;
  inline constexpr eosio::name RECEIVE_CONFIRM  = "receivecnf"_n;
  inline constexpr eosio::name CONVERT_TO_AXN   = "converttoaxn"_n;
  inline constexpr eosio::name ACT2_PROGRAM_PROP= "act2prop"_n;
}

/**
 * @brief Элементарные операции по кошелькам.
 */
enum class WalletOp : uint8_t {
  ISSUE    = 0, ///< первичный вход средств на кошелёк wallet_to
  TRANSFER = 1, ///< перемещение wallet_from → wallet_to
  BLOCK    = 2, ///< available-=amount, blocked+=amount на wallet_from
  UNBLOCK  = 3, ///< blocked-=amount, available+=amount на wallet_from
};

/**
 * @brief Описание одной именованной операции.
 */
struct ActionRegistryEntry {
  eosio::name    code;               ///< action_code
  WalletOp       wallet_op;
  uint64_t       wallet_from;        ///< 0 для ISSUE
  uint64_t       wallet_to;          ///< 0 для BLOCK/UNBLOCK
  uint64_t       debit_account_id;
  uint64_t       credit_account_id;
  const char*    human_name;
};

/**
 * @brief Хардкод-реестр именованных операций MVP.
 *
 * Порядок записей не важен (линейный поиск в ledger2::apply).
 * Добавлять новые записи только через релиз контракта.
 */
static constexpr ActionRegistryEntry ACTION_REGISTRY[] = {
  // 1. Вступительный взнос: money comes in → ENTRANCE_FEES wallet; Dr 51 / Cr 86.01
  { ledger2_ops::ENTRANCE_FEE, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::ENTRANCE_FEES,
    "Вступительный взнос пайщика" },

  // 2. Минимальный пай: money comes in → MIN_SHARE_FUND wallet (отдельный
  //    фонд для обязательных паёв при регистрации); Dr 51 / Cr 80
  { ledger2_ops::INITIAL_SHARE, WalletOp::ISSUE, 0, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос" },

  // 3. Депозит (завершение): money comes in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::DEPOSIT_COMPLETE, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат пая (завершение): money leaves → TRANSFER SHARE_FUND → WITHDRAWALS_SINK;
  //    Dr 80 / Cr 51 (пассив уменьшается, актив уменьшается)
  { ledger2_ops::WITHDRAW_COMPLETE, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::WITHDRAWALS_SINK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Капитальный взнос: money comes in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::CAPITAL_IMPORT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Капитальный взнос (Благорост)" },

  // 6. Заём получен: задолженность кооператива растёт; LONG_TERM_LOANS wallet++; Dr 51 / Cr 67
  { ledger2_ops::LOAN_REPAYMENT, WalletOp::ISSUE, 0, ledger2_wallets::LONG_TERM_LOANS,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::LONG_TERM_LOANS,
    "Получение долгосрочного займа" },

  // 7. Сдача задания — прирост паевого фонда: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::ACT2_SHARE, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту выполненных работ" },

  // 8. Сдача задания — гашение долга: LONG_TERM_LOANS → DEBT_CLOSED_SINK; Dr 67 / Cr 51
  { ledger2_ops::ACT2_LOAN, WalletOp::TRANSFER, ledger2_wallets::LONG_TERM_LOANS, ledger2_wallets::DEBT_CLOSED_SINK,
    ledger2_accounts::LONG_TERM_LOANS, ledger2_accounts::BANK_ACCOUNT,
    "Гашение долга по акту выполненных работ" },

  // 9. Подтверждение поставки: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::SUPPLY_CONFIRM, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Подтверждение поставки товара/услуги" },

  // 10. Подтверждение получения: SHARE_FUND → SUPPLIER_PAYMENTS; Dr 80 / Cr 51
  { ledger2_ops::RECEIVE_CONFIRM, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Подтверждение получения товара/услуги — выплата поставщику" },

  // 11. Конверт в AXN: SHARE_FUND → DELEGATE_FEES; Dr 80 / Cr 868 (делегатские взносы)
  { ledger2_ops::CONVERT_TO_AXN, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::DELEGATE_FEES_FUND,
    "Конвертация паевого взноса в делегатские членские взносы" },

  // 12. Акт 2 по программному имущественному взносу: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::ACT2_PROGRAM_PROP, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту 2 программного имущественного взноса" },
};

static constexpr size_t ACTION_REGISTRY_SIZE = sizeof(ACTION_REGISTRY) / sizeof(ACTION_REGISTRY[0]);

/**
 * @brief Линейный поиск записи реестра по action_code.
 * @return указатель на запись или nullptr при отсутствии.
 */
inline const ActionRegistryEntry* ledger2_find_action(eosio::name action_code) {
  for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
    if (ACTION_REGISTRY[i].code == action_code) {
      return &ACTION_REGISTRY[i];
    }
  }
  return nullptr;
}
