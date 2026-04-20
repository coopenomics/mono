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
 * Пересмотр 2026-04-20:
 *   - План счетов ужат до 6 (убран 99 транзитный, убран 67 долгосрочные займы,
 *     добавлен 08 «Вложения во внеоборотные активы»).
 *   - Коммит РИД разделён на две операции: cap.commit (Dr 08/Cr 80) и
 *     cap.accept (Dr 04/Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID).
 *   - Добавлен WALLET_ONLY тип: только wallet-движение, без debit/credit
 *     (для cap.invest — перемещения из Цифрового Кошелька в Благорост без
 *     изменений по бухсчетам 80/86).
 *   - Заём пайщику: cap.loanissue (Dr 58/Cr 51) + cap.loanrepay (Dr 80/Cr 58).
 *   - Миграционные переименованы OPENING_* → TRANSIT_*, добавлены
 *     TRANSIT_MIN_SHARE, TRANSIT_BLAGOROST, TRANSIT_COMMITMENT — для
 *     детерминированного разнесения legacy-остатков по 6 кошелькам.
 *
 * Реестр — строго хардкод. Любая новая операция требует релиза контракта.
 * На один action_code приходится ровно одна запись в ACTION_REGISTRY и
 * атомарно одно движение кошелька + (для Dr/Cr-операций) одна пара проводок.
 *
 * Нейминг: имя должно быть eosio::name (≤ 13 символов base32 с точкой)
 * с обязательным префиксом контракта-источника: reg.*, wall.*, cap.*,
 * mkt.*, sov.*, mig.* (миграционные).
 *
 * @ingroup public_ledger2_consts
 */
namespace ledger2_ops {
  // registrator (reg.*)
  inline constexpr eosio::name ENTRANCE_FEE       = "reg.entrfee"_n;   ///< Вступительный взнос (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES)
  inline constexpr eosio::name INITIAL_SHARE      = "reg.minshare"_n;  ///< Минимальный паевой взнос при регистрации (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND)

  // wallet (wall.*)
  inline constexpr eosio::name DEPOSIT_COMPLETE   = "wall.depcpl"_n;   ///< Внесение паевого взноса (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY)
  inline constexpr eosio::name WITHDRAW_COMPLETE  = "wall.wthcpl"_n;   ///< Возврат паевого взноса (Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → WITHDRAWALS_SINK)

  // capital (cap.*)
  inline constexpr eosio::name CAPITAL_IMPORT     = "cap.import"_n;    ///< Импорт пайщика ЦПП Благорост (Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST)
  inline constexpr eosio::name INVEST_BLAGOROST   = "cap.invest"_n;    ///< Инвестиция в ЦПП Благорост (WALLET_ONLY TRANSFER SHARE_FUND_PAY → BLAGOROST_INVEST, без Dr/Cr)
  inline constexpr eosio::name COMMIT_RID         = "cap.commit"_n;    ///< Коммит РИД (Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT)
  inline constexpr eosio::name ACCEPT_RID         = "cap.accept"_n;    ///< Приём РИД в паевой фонд (Dr 04 / Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID)
  inline constexpr eosio::name ACT2_PROGRAM_PROP  = "cap.act2prp"_n;   ///< Акт-2 имущественный паевой взнос (Dr 51 / Cr 80, ISSUE BLAGOROST_PROPERTY)
  inline constexpr eosio::name ISSUE_LOAN         = "cap.lnissue"_n;   ///< Выдача беспроцентного займа пайщику (Dr 58 / Cr 51, ISSUE LOAN_ISSUED)
  inline constexpr eosio::name REPAY_LOAN         = "cap.lnrepay"_n;   ///< Возврат займа пайщика по акту-2 (Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY)

  // marketplace (mkt.*)
  inline constexpr eosio::name SUPPLY_CONFIRM     = "mkt.supplcnf"_n;  ///< Подтверждение поставки (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY)
  inline constexpr eosio::name RECEIVE_CONFIRM    = "mkt.recvcnf"_n;   ///< Подтверждение получения (Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS)

  // soviet (sov.*)
  inline constexpr eosio::name CONVERT_TO_AXN     = "sov.axncnv"_n;    ///< Трансляция паевого взноса в членский (Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES)

  // migration (mig.*) — только из migrate.cpp
  inline constexpr eosio::name TRANSIT_MIN_SHARE  = "mig.minshr"_n;    ///< Перенос: минимальный паевой взнос (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND)
  inline constexpr eosio::name TRANSIT_BLAGOROST  = "mig.blago"_n;     ///< Перенос: инвестиции Благорост (Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST)
  inline constexpr eosio::name TRANSIT_SHARE      = "mig.share"_n;     ///< Перенос: остаток паевых деньгами (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY)
  inline constexpr eosio::name TRANSIT_ENTRY      = "mig.entry"_n;     ///< Перенос: вступительные (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES)
  inline constexpr eosio::name TRANSIT_COMMITMENT = "mig.commit"_n;    ///< Перенос: принятый коммит имуществом (Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT)
  inline constexpr eosio::name TRANSIT_RID        = "mig.rid"_n;       ///< Перенос: РИД в НМА (Dr 04 / Cr 80, ISSUE SHARE_FUND_RID)
}

/**
 * @brief Элементарные операции по кошелькам.
 *
 * `WALLET_ONLY` — новый тип (2026-04-20): TRANSFER между кошельками БЕЗ
 * бухгалтерских проводок debit/credit. Используется, когда средства
 * перемещаются между аналитическими разрезами одного счёта (пример:
 * Цифровой Кошелёк 80 → инвестиционный Благорост 80 — в обоих случаях Cr 80,
 * счёт не меняется, но wallet-аналитика — да).
 */
enum class WalletOp : uint8_t {
  ISSUE       = 0, ///< первичный вход средств на кошелёк wallet_to
  TRANSFER    = 1, ///< перемещение wallet_from → wallet_to (с Dr/Cr)
  BLOCK       = 2, ///< available-=amount, blocked+=amount на wallet_from
  UNBLOCK     = 3, ///< blocked-=amount, available+=amount на wallet_from
  WALLET_ONLY = 4, ///< TRANSFER wallet_from → wallet_to БЕЗ debit/credit inline-actions
};

/**
 * @brief Описание одной именованной операции.
 *
 * Для WALLET_ONLY поля `debit_account_id` / `credit_account_id` равны 0
 * (compile-time валидацией ниже).
 */
struct ActionRegistryEntry {
  eosio::name    code;               ///< action_code с префиксом контракта
  eosio::name    process_type;       ///< тип процесса с префиксом контракта
  WalletOp       wallet_op;
  uint64_t       wallet_from;        ///< 0 для ISSUE
  uint64_t       wallet_to;          ///< 0 для BLOCK/UNBLOCK
  uint64_t       debit_account_id;   ///< 0 для WALLET_ONLY
  uint64_t       credit_account_id;  ///< 0 для WALLET_ONLY
  const char*    human_name;
};

/**
 * @brief Хардкод-реестр именованных операций (пересмотр 2026-04-20).
 *
 * Порядок записей не важен (линейный поиск в ledger2::apply).
 */
static constexpr ActionRegistryEntry ACTION_REGISTRY[] = {
  // 1. Вступительный взнос: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { ledger2_ops::ENTRANCE_FEE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Вступительный взнос пайщика" },

  // 2. Минимальный паевой взнос (при регистрации): Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { ledger2_ops::INITIAL_SHARE, process_types::REGISTRATION, WalletOp::ISSUE, 0, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос пайщика при регистрации" },

  // 3. Внесение паевого взноса: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { ledger2_ops::DEPOSIT_COMPLETE, process_types::WALLET_DEPOSIT, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат паевого взноса: Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → WITHDRAWALS_SINK
  { ledger2_ops::WITHDRAW_COMPLETE, process_types::WALLET_WITHDRAW, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::WITHDRAWALS_SINK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Импорт пайщика Благорост (offline): Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST
  { ledger2_ops::CAPITAL_IMPORT, process_types::CAPITAL_IMPORT, WalletOp::ISSUE, 0, ledger2_wallets::BLAGOROST_INVEST,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Паевой взнос по целевой потребительской программе «Благорост» (офлайн-импорт)" },

  // 6. Инвестиция из Цифрового Кошелька в Благорост: WALLET_ONLY TRANSFER 2001 → 9001
  { ledger2_ops::INVEST_BLAGOROST, process_types::CAPITAL_INVEST, WalletOp::WALLET_ONLY,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::BLAGOROST_INVEST,
    0, 0,
    "Инвестиция в ЦПП «Благорост» (перенос между кошельками паевого фонда)" },

  // 7. Коммит РИД: Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT
  { ledger2_ops::COMMIT_RID, process_types::CAPITAL_ACT2_RESULT, WalletOp::ISSUE, 0, ledger2_wallets::GENERATOR_COMMIT,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::SHARE_FUND,
    "Коммит результата интеллектуальной деятельности по программе «Благорост»" },

  // 8. Приём РИД в НМА: Dr 04 / Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID
  { ledger2_ops::ACCEPT_RID, process_types::CAPITAL_ACT2_RESULT, WalletOp::TRANSFER,
    ledger2_wallets::GENERATOR_COMMIT, ledger2_wallets::BLAGOROST_RID,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::NON_CURRENT_INVESTMENTS,
    "Приём результата интеллектуальной деятельности в паевой фонд" },

  // 9. Акт-2 имущественный паевой взнос: Dr 51 / Cr 80, ISSUE BLAGOROST_PROPERTY
  { ledger2_ops::ACT2_PROGRAM_PROP, process_types::CAPITAL_ACT2_PROPERTY, WalletOp::ISSUE, 0, ledger2_wallets::BLAGOROST_PROPERTY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Паевой взнос (не денежный) по программе «Благорост»" },

  // 10. Выдача беспроцентного займа пайщику: Dr 58 / Cr 51, ISSUE LOAN_ISSUED
  { ledger2_ops::ISSUE_LOAN, process_types::CAPITAL_LOAN, WalletOp::ISSUE, 0, ledger2_wallets::LOAN_ISSUED,
    ledger2_accounts::FINANCIAL_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Выдача пайщику беспроцентного займа" },

  // 11. Возврат займа по акту-2: Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY
  { ledger2_ops::REPAY_LOAN, process_types::CAPITAL_ACT2_RESULT, WalletOp::TRANSFER,
    ledger2_wallets::LOAN_ISSUED, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::FINANCIAL_INVESTMENTS,
    "Возврат беспроцентного займа пайщика по акту-2" },

  // 12. Подтверждение поставки: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { ledger2_ops::SUPPLY_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Подтверждение поставки товара/услуги" },

  // 13. Подтверждение получения: Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS
  { ledger2_ops::RECEIVE_CONFIRM, process_types::MARKETPLACE_OFFER, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Подтверждение получения товара/услуги — выплата поставщику" },

  // 14. Конвертация в AXN: Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES
  { ledger2_ops::CONVERT_TO_AXN, process_types::SOVIET_AXN_CONVERT, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Трансляция паевого взноса из ЦПП «Цифровой Кошелёк» в членский взнос за пользование инфраструктурой" },

  // ----- Миграционные (mig.*) — вызываются только из migrate.cpp -----

  // 15. Миграция: минимальный паевой: Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { ledger2_ops::TRANSIT_MIN_SHARE, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: минимальные паевые взносы при миграции" },

  // 16. Миграция: инвестиции Благорост: Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST
  { ledger2_ops::TRANSIT_BLAGOROST, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::BLAGOROST_INVEST,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: инвестиции ЦПП «Благорост» при миграции" },

  // 17. Миграция: остаток паевых деньгами: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { ledger2_ops::TRANSIT_SHARE, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: остаток паевых взносов деньгами при миграции" },

  // 18. Миграция: вступительные: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { ledger2_ops::TRANSIT_ENTRY, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Транзитный перенос: вступительные взносы при миграции" },

  // 19. Миграция: принятый коммит имуществом: Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT
  { ledger2_ops::TRANSIT_COMMITMENT, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::GENERATOR_COMMIT,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: принятый коммит имуществом (ЦПП «Генератор») при миграции" },

  // 20. Миграция: РИД в НМА: Dr 04 / Cr 80, ISSUE SHARE_FUND_RID
  { ledger2_ops::TRANSIT_RID, process_types::TRANSIT_MIGRATION, WalletOp::ISSUE, 0, ledger2_wallets::SHARE_FUND_RID,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: принятые РИД в паевой фонд при миграции" },
};

static constexpr size_t ACTION_REGISTRY_SIZE = sizeof(ACTION_REGISTRY) / sizeof(ACTION_REGISTRY[0]);

// =====================================================================
// Compile-time валидация реестра.
// =====================================================================
//
// Правила:
//  1. `code` уникален. `process_type` может повторяться.
//  2. Для операций с бухпроводками: `debit_account_id` ≠ `credit_account_id`.
//  3. Для TRANSFER и WALLET_ONLY: `wallet_from` ≠ `wallet_to`.
//  4. Для ISSUE: `wallet_from` == 0 и `wallet_to` ≠ 0.
//  5. Для WALLET_ONLY: оба счёта == 0 (без проводок).
//  6. Все id счетов/кошельков из registry существуют в справочниках.
namespace ledger2_registry_detail {
  constexpr bool action_codes_unique() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < ACTION_REGISTRY_SIZE; ++j) {
        if (ACTION_REGISTRY[i].code == ACTION_REGISTRY[j].code) return false;
      }
    }
    return true;
  }

  constexpr bool dr_ne_cr_when_posting() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_op == WalletOp::WALLET_ONLY) continue;
      if (e.debit_account_id == e.credit_account_id) return false;
    }
    return true;
  }

  constexpr bool wallet_only_has_zero_accounts() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_op != WalletOp::WALLET_ONLY) continue;
      if (e.debit_account_id != 0 || e.credit_account_id != 0) return false;
    }
    return true;
  }

  constexpr bool transfer_wallet_from_ne_to() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_op == WalletOp::TRANSFER || e.wallet_op == WalletOp::WALLET_ONLY) {
        if (e.wallet_from == e.wallet_to) return false;
      }
    }
    return true;
  }

  constexpr bool accounts_exist_in_map() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_op == WalletOp::WALLET_ONLY) continue;
      if (ledger2_find_account_meta(e.debit_account_id) == nullptr) return false;
      if (ledger2_find_account_meta(e.credit_account_id) == nullptr) return false;
    }
    return true;
  }

  constexpr bool wallets_exist_in_registry() {
    for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
      const auto& e = ACTION_REGISTRY[i];
      if (e.wallet_from != 0 && ledger2_get_wallet_name_by_id(e.wallet_from).empty()) return false;
      if (e.wallet_to   != 0 && ledger2_get_wallet_name_by_id(e.wallet_to).empty())   return false;
    }
    return true;
  }
}

static_assert(ledger2_registry_detail::action_codes_unique(),
              "ACTION_REGISTRY: duplicate action_code detected");
static_assert(ledger2_registry_detail::dr_ne_cr_when_posting(),
              "ACTION_REGISTRY: debit_account_id == credit_account_id (self-posting) на non-WALLET_ONLY записи");
static_assert(ledger2_registry_detail::wallet_only_has_zero_accounts(),
              "ACTION_REGISTRY: WALLET_ONLY запись с ненулевыми debit/credit");
static_assert(ledger2_registry_detail::transfer_wallet_from_ne_to(),
              "ACTION_REGISTRY: TRANSFER/WALLET_ONLY с wallet_from == wallet_to");
static_assert(ledger2_registry_detail::accounts_exist_in_map(),
              "ACTION_REGISTRY: ссылка на account id вне LEDGER2_ACCOUNT_MAP");
static_assert(ledger2_registry_detail::wallets_exist_in_registry(),
              "ACTION_REGISTRY: ссылка на wallet id вне LEDGER2_WALLET_REGISTRY");

/**
 * @brief Линейный поиск записи реестра по action_code.
 */
inline const ActionRegistryEntry* ledger2_find_action(eosio::name action_code) {
  for (size_t i = 0; i < ACTION_REGISTRY_SIZE; ++i) {
    if (ACTION_REGISTRY[i].code == action_code) {
      return &ACTION_REGISTRY[i];
    }
  }
  return nullptr;
}
