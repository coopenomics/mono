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
 * Пересмотр 2026-04-18 (PRD §4.1.6a):
 *   - Cr 86.01 (ENTRANCE_FEES) → Cr 86 (TARGET_RECEIPTS — единый бух-счёт
 *     целевого финансирования, детализация через wallets).
 *   - Cr 86.8 (DELEGATE_FEES_FUND) → Cr 86 для CONVERT_TO_AXN; subaccount 86.8
 *     удалён из плана счетов.
 *   - Wallet-id сменены на 1001/2001/3001/4001 с шагом ×1000.
 *   - Добавлены 4 миграционных action_code: mig.opncash / mig.opnshr /
 *     mig.opnent / mig.opnrid (через счёт 99 «Переходные остатки»).
 *
 * Реестр — строго хардкод. Любая новая операция требует релиза контракта,
 * менять на лету нельзя. На один action_code приходится ровно одна запись
 * в ACTION_REGISTRY и атомарно одно движение кошелька + одна пара проводок.
 *
 * Нейминг: имя должно быть eosio::name (≤ 13 символов base32 с точкой)
 * с обязательным префиксом контракта-источника: reg.*, wall.*, cap.*,
 * mkt.*, sov.*, mig.* (миграционные).
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
  inline constexpr eosio::name LOAN_REPAYMENT   = "cap.loanrpy"_n;   ///< capital: подтверждение выданной ссуды [ТРЕБУЕТ УТОЧНЕНИЯ — зависит от активации 67]
  inline constexpr eosio::name ACT2_SHARE       = "cap.act2shr"_n;   ///< capital: акт-2 результат — внесение результата в паевой фонд
  inline constexpr eosio::name ACT2_LOAN        = "cap.act2ln"_n;    ///< capital: акт-2 результат — гашение долга [ТРЕБУЕТ УТОЧНЕНИЯ]
  inline constexpr eosio::name ACT2_PROGRAM_PROP= "cap.act2prp"_n;   ///< capital: акт-2 имущественный программный взнос

  // marketplace (mkt.*)
  inline constexpr eosio::name SUPPLY_CONFIRM   = "mkt.supplcnf"_n;  ///< marketplace: подтверждение поставки
  inline constexpr eosio::name RECEIVE_CONFIRM  = "mkt.recvcnf"_n;   ///< marketplace: подтверждение получения

  // soviet (sov.*)
  inline constexpr eosio::name CONVERT_TO_AXN   = "sov.axncnv"_n;    ///< soviet: конвертация RUB → AXN (одноактовый)

  // migration (mig.*) — вызываются только из migrate.cpp
  inline constexpr eosio::name OPENING_CASH     = "mig.opncash"_n;   ///< migrate: opening-баланс расчётного (Dr 51 / Cr 99)
  inline constexpr eosio::name OPENING_SHARE    = "mig.opnshr"_n;    ///< migrate: opening-баланс паевого фонда (Dr 99 / Cr 80)
  inline constexpr eosio::name OPENING_ENTRY    = "mig.opnent"_n;    ///< migrate: opening-баланс целевого финансирования (Dr 99 / Cr 86)
  inline constexpr eosio::name OPENING_RID      = "mig.opnrid"_n;    ///< migrate: корректировка РИД (Dr 04 / Cr 80)
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
 * @brief Хардкод-реестр именованных операций MVP (пересмотр 2026-04-18).
 *
 * Порядок записей не важен (линейный поиск в ledger2::apply).
 * Добавлять новые записи только через релиз контракта.
 */
static constexpr ActionRegistryEntry ACTION_REGISTRY[] = {
  // 1. Вступительный взнос: money in → ENTRANCE_FEES (3001); Dr 51 / Cr 86
  { ledger2_ops::ENTRANCE_FEE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Вступительный взнос пайщика" },

  // 2. Минимальный пай (при регистрации): money in → MIN_SHARE_FUND (2002); Dr 51 / Cr 80
  { ledger2_ops::INITIAL_SHARE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос" },

  // 3. Депозит (завершение): money in → SHARE_FUND_PAY (2001); Dr 51 / Cr 80
  { ledger2_ops::DEPOSIT_COMPLETE, process_types::WALLET_DEPOSIT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат пая (завершение): TRANSFER SHARE_FUND_PAY → WITHDRAWALS_SINK; Dr 80 / Cr 51
  { ledger2_ops::WITHDRAW_COMPLETE, process_types::WALLET_WITHDRAW, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::WITHDRAWALS_SINK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Капитальный взнос: money in → SHARE_FUND_PAY (2001); Dr 51 / Cr 80
  { ledger2_ops::CAPITAL_IMPORT, process_types::CAPITAL_IMPORT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Капитальный взнос (Благорост offline)" },

  // 6. Заём получен: money in → LOAN_RECEIVED (4050); Dr 51 / Cr 67 [ТРЕБУЕТ УТОЧНЕНИЯ]
  { ledger2_ops::LOAN_REPAYMENT, process_types::CAPITAL_DEBT, WalletOp::ISSUE, 0, ledger2_wallets::LOAN_RECEIVED,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::LONG_TERM_LOANS,
    "Получение долгосрочного займа [ТРЕБУЕТ УТОЧНЕНИЯ: активация 67]" },

  // 7. Акт-2 — прирост паевого фонда: money in → SHARE_FUND_PAY (2001); Dr 51 / Cr 80
  { ledger2_ops::ACT2_SHARE, process_types::CAPITAL_ACT2_RESULT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту выполненных работ" },

  // 8. Акт-2 — гашение долга: TRANSFER LOAN_RECEIVED (4050) → DEBT_CLOSED_SINK (4052); Dr 67 / Cr 51 [ТРЕБУЕТ УТОЧНЕНИЯ]
  { ledger2_ops::ACT2_LOAN, process_types::CAPITAL_ACT2_RESULT, WalletOp::TRANSFER, ledger2_wallets::LOAN_RECEIVED, ledger2_wallets::DEBT_CLOSED_SINK,
    ledger2_accounts::LONG_TERM_LOANS, ledger2_accounts::BANK_ACCOUNT,
    "Гашение долга по акту выполненных работ [ТРЕБУЕТ УТОЧНЕНИЯ: активация 67]" },

  // 9. Акт-2 имущественный программный взнос: money in → SHARE_FUND_PAY (2001); Dr 51 / Cr 80
  //    TODO: после решения по ЦПП-кошелькам (FR-L-12a) — направлять на 9002 (приём РИД программы).
  { ledger2_ops::ACT2_PROGRAM_PROP, process_types::CAPITAL_ACT2_PROPERTY, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Прирост паевого фонда по акту 2 программного имущественного взноса" },

  // 10. Подтверждение поставки: money in → SHARE_FUND_PAY (2001); Dr 51 / Cr 80
  { ledger2_ops::SUPPLY_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Подтверждение поставки товара/услуги" },

  // 11. Подтверждение получения: TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS (4002); Dr 80 / Cr 51
  { ledger2_ops::RECEIVE_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Подтверждение получения товара/услуги — выплата поставщику" },

  // 12. Конверт в AXN: TRANSFER SHARE_FUND_PAY (2001) → DELEGATE_FEES (3003); Dr 80 / Cr 86
  //     (FR-L-14a: старое Cr 868 заменено на Cr 86 — субсчёт удалён из плана)
  { ledger2_ops::CONVERT_TO_AXN, process_types::SOVIET_AXN_CONVERT, WalletOp::TRANSFER, ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Конвертация паевого взноса в делегатские членские взносы" },

  // ----- Миграционные (mig.*) — вызываются только из migrate.cpp -----

  // 13. Opening расчётного: money «входит» на CASH_MAIN (1001); Dr 51 / Cr 99
  { ledger2_ops::OPENING_CASH, process_types::OPENING_BALANCE, WalletOp::ISSUE, 0, ledger2_wallets::CASH_MAIN,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::OPENING_TRANSIT,
    "Opening-баланс расчётного счёта (миграция)" },

  // 14. Opening паевого (money part): Dr 99 / Cr 80 (транзит превращается в паевой)
  { ledger2_ops::OPENING_SHARE, process_types::OPENING_BALANCE, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::OPENING_TRANSIT, ledger2_accounts::SHARE_FUND,
    "Opening-баланс паевого фонда (миграция, денежная часть)" },

  // 15. Opening целевого: Dr 99 / Cr 86 (транзит превращается в целевое финансирование)
  { ledger2_ops::OPENING_ENTRY, process_types::OPENING_BALANCE, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::OPENING_TRANSIT, ledger2_accounts::TARGET_RECEIPTS,
    "Opening-баланс целевого финансирования (миграция, вступительные)" },

  // 16. Opening РИД: Dr 04 / Cr 80 (НМА приняты как паевой взнос) — Восход, 56 833 411 RUB
  { ledger2_ops::OPENING_RID, process_types::OPENING_RID, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_RID,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Opening-корректировка РИД в паевой фонд (миграция)" },
};

static constexpr size_t ACTION_REGISTRY_SIZE = sizeof(ACTION_REGISTRY) / sizeof(ACTION_REGISTRY[0]);

// =====================================================================
// Compile-time валидация реестра.
// =====================================================================
//
// Правила:
//  1. `code` должен быть уникален в реестре. `process_type` может повторяться.
//  2. `debit_account_id` ≠ `credit_account_id` (без self-проводок).
//  3. Для TRANSFER: `wallet_from` ≠ `wallet_to` (без self-переводов).
//  4. Для ISSUE: `wallet_from` == 0 и `wallet_to` ≠ 0.
//  5. Все id счетов из registry существуют в LEDGER2_ACCOUNT_MAP.
//  6. Все id кошельков из registry существуют в LEDGER2_WALLET_REGISTRY
//     (или == 0 для ISSUE/BLOCK).
//
// Runtime-проверок не выполняем: ресурсы блокчейна не тратятся на то, что
// гарантировано сборкой.
namespace ledger2_registry_detail {
  constexpr bool action_codes_unique() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < ACTION_REGISTRY_SIZE; ++j) {
        if (ACTION_REGISTRY[i].code == ACTION_REGISTRY[j].code) return false;
      }
    }
    return true;
  }

  constexpr bool dr_ne_cr() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      if (ACTION_REGISTRY[i].debit_account_id == ACTION_REGISTRY[i].credit_account_id) return false;
    }
    return true;
  }

  constexpr bool transfer_wallet_from_ne_to() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_op == WalletOp::TRANSFER && e.wallet_from == e.wallet_to) return false;
    }
    return true;
  }

  constexpr bool accounts_exist_in_map() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (ledger2_find_account_meta(e.debit_account_id) == nullptr) return false;
      if (ledger2_find_account_meta(e.credit_account_id) == nullptr) return false;
    }
    return true;
  }
}

static_assert(ledger2_registry_detail::action_codes_unique(),
              "ACTION_REGISTRY: duplicate action_code detected");
static_assert(ledger2_registry_detail::dr_ne_cr(),
              "ACTION_REGISTRY: debit_account_id == credit_account_id (self-posting)");
static_assert(ledger2_registry_detail::transfer_wallet_from_ne_to(),
              "ACTION_REGISTRY: TRANSFER with wallet_from == wallet_to (self-transfer)");
static_assert(ledger2_registry_detail::accounts_exist_in_map(),
              "ACTION_REGISTRY: references an account id not in LEDGER2_ACCOUNT_MAP");

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
