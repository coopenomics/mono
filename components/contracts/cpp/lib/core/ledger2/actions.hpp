#pragma once

#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

#include "accounts.hpp"
#include "process_types.hpp"
#include "wallets.hpp"

/**
 * @brief Именованные операции ledger2 (action codes).
 *
 * Реестр — строго хардкод. Любая новая операция требует релиза
 * контракта, менять на лету нельзя. На один action_code приходится
 * ровно одна запись в ACTION_REGISTRY и атомарно одно движение
 * кошелька + одна пара проводок.
 *
 * Нейминг: имя должно быть eosio::name (≤ 13 символов base32 с точкой)
 * с обязательным префиксом контракта-источника: reg.*, wall.*, cap.*,
 * mkt.*, sov.*.
 *
 * @ingroup public_ledger2_consts
 */
namespace ledger2_ops {
  // registrator (reg.*)
  inline constexpr eosio::name ENTRANCE_FEE     = "reg.entrfee"_n;   ///< registrator: вступительный взнос
  inline constexpr eosio::name INITIAL_SHARE    = "reg.minshare"_n;  ///< registrator: минимальный паевой взнос (часть регистрации)

  // wallet (wall.*)
  inline constexpr eosio::name DEPOSIT_COMPLETE = "wall.depcpl"_n;   ///< wallet: завершение внесения паевого взноса
  inline constexpr eosio::name WITHDRAW_COMPLETE= "wall.wthcpl"_n;   ///< wallet: возврат паевого взноса

  // capital (cap.*)
  inline constexpr eosio::name CAPITAL_IMPORT   = "cap.import"_n;    ///< capital: импорт контрибьютора (Благорост offline)
  inline constexpr eosio::name LOAN_REPAYMENT   = "cap.loanrpy"_n;   ///< capital: подтверждение выданной ссуды
  inline constexpr eosio::name ACT2_SHARE       = "cap.act2shr"_n;   ///< capital: акт-2 результат — внесение результата в паевой фонд
  inline constexpr eosio::name ACT2_LOAN        = "cap.act2ln"_n;    ///< capital: акт-2 результат — гашение долга (тот же процесс)
  inline constexpr eosio::name ACT2_PROGRAM_PROP= "cap.act2prp"_n;   ///< capital: акт-2 имущественный программный взнос

  // marketplace (mkt.*)
  inline constexpr eosio::name SUPPLY_CONFIRM   = "mkt.supplcnf"_n;  ///< marketplace: подтверждение поставки
  inline constexpr eosio::name RECEIVE_CONFIRM  = "mkt.recvcnf"_n;   ///< marketplace: подтверждение получения

  // soviet (sov.*)
  inline constexpr eosio::name CONVERT_TO_AXN   = "sov.axncnv"_n;    ///< soviet: конвертация RUB → AXN (одноактовый)
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
 *
 * Поле `process_type` — тип семантического процесса, к которому принадлежит
 * данная операция. Один `process_type` может встречаться в нескольких
 * записях реестра (мульти-операционные процессы явно разрешены — см.
 * architecture.md §4.2).
 */
struct ActionRegistryEntry {
  eosio::name    code;               ///< action_code с префиксом контракта (см. §4.2)
  eosio::name    process_type;       ///< тип процесса с префиксом контракта (см. §4.2)
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
  { ledger2_ops::ENTRANCE_FEE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::ENTRANCE_FEES,
    "Вступительный взнос пайщика" },

  // 2. Минимальный пай: money comes in → MIN_SHARE_FUND wallet (отдельный
  //    фонд для обязательных паёв при регистрации); Dr 51 / Cr 80
  { ledger2_ops::INITIAL_SHARE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос" },

  // 3. Депозит (завершение): money comes in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::DEPOSIT_COMPLETE, process_types::WALLET_DEPOSIT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат пая (завершение): money leaves → TRANSFER SHARE_FUND → WITHDRAWALS_SINK;
  //    Dr 80 / Cr 51 (пассив уменьшается, актив уменьшается)
  { ledger2_ops::WITHDRAW_COMPLETE, process_types::WALLET_WITHDRAW, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::WITHDRAWALS_SINK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Капитальный взнос: money comes in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::CAPITAL_IMPORT, process_types::CAPITAL_IMPORT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Капитальный взнос (Благорост)" },

  // 6. Заём получен: задолженность кооператива растёт; LONG_TERM_LOANS wallet++; Dr 51 / Cr 67
  { ledger2_ops::LOAN_REPAYMENT, process_types::CAPITAL_DEBT, WalletOp::ISSUE, 0, ledger2_wallets::LONG_TERM_LOANS,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::LONG_TERM_LOANS,
    "Получение долгосрочного займа" },

  // 7. Сдача задания — прирост паевого фонда: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::ACT2_SHARE, process_types::CAPITAL_ACT2_RESULT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту выполненных работ" },

  // 8. Сдача задания — гашение долга: LONG_TERM_LOANS → DEBT_CLOSED_SINK; Dr 67 / Cr 51
  { ledger2_ops::ACT2_LOAN, process_types::CAPITAL_ACT2_RESULT, WalletOp::TRANSFER, ledger2_wallets::LONG_TERM_LOANS, ledger2_wallets::DEBT_CLOSED_SINK,
    ledger2_accounts::LONG_TERM_LOANS, ledger2_accounts::BANK_ACCOUNT,
    "Гашение долга по акту выполненных работ" },

  // 9. Подтверждение поставки: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::SUPPLY_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Подтверждение поставки товара/услуги" },

  // 10. Подтверждение получения: SHARE_FUND → SUPPLIER_PAYMENTS; Dr 80 / Cr 51
  { ledger2_ops::RECEIVE_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Подтверждение получения товара/услуги — выплата поставщику" },

  // 11. Конверт в AXN: SHARE_FUND → DELEGATE_FEES; Dr 80 / Cr 868 (делегатские взносы)
  { ledger2_ops::CONVERT_TO_AXN, process_types::SOVIET_AXN_CONVERT, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::DELEGATE_FEES_FUND,
    "Конвертация паевого взноса в делегатские членские взносы" },

  // 12. Акт 2 по программному имущественному взносу: money in → SHARE_FUND; Dr 51 / Cr 80
  { ledger2_ops::ACT2_PROGRAM_PROP, process_types::CAPITAL_ACT2_PROPERTY, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту 2 программного имущественного взноса" },
};

static constexpr size_t ACTION_REGISTRY_SIZE = sizeof(ACTION_REGISTRY) / sizeof(ACTION_REGISTRY[0]);

// =====================================================================
// Compile-time валидация реестра: уникальность action_code.
// =====================================================================
//
// Правило: `code` должен быть уникален в реестре. `process_type` может
// повторяться (мульти-операционные процессы явно разрешены — см. §4.2).
// Runtime-проверок не выполняем: ресурсы блокчейна не тратятся на то, что
// гарантировано сборкой.
namespace ledger2_registry_detail {
  constexpr bool action_codes_unique() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < ACTION_REGISTRY_SIZE; ++j) {
        if (ACTION_REGISTRY[i].code == ACTION_REGISTRY[j].code) {
          return false;
        }
      }
    }
    return true;
  }
}

static_assert(ledger2_registry_detail::action_codes_unique(),
              "ACTION_REGISTRY: duplicate action_code detected");

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
