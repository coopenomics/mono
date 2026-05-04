#pragma once

#include <array>
#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

#include "accounts.hpp"
#include "processes.hpp"
#include "wallets.hpp"

/**
 * @brief Реестр именованных операций ledger2 (operation registry).
 *
 * Нейминг-рефакторинг 2026-04-24:
 *   - Раньше файл назывался `actions.hpp`, массив — `ACTION_REGISTRY`,
 *     namespace — `ledger2_ops`. Термин «action» конфликтовал с
 *     `[[eosio::action]]`, смысл operation (walletop + опц. Dr/Cr) был смазан.
 *     Теперь — «операция» (operation): атомарная единица учёта ledger2.
 *   - eosio::name-строки получили префикс `o.` (operation), чтобы
 *     отличаться от process_type (`p.`) и не коллидировать по смыслу.
 *   - C++-константы разложены по вложенным namespace по контрактам-источникам
 *     (`operations::registrator::`, `operations::capital::` и т.д.) — контракт
 *     считывается по месту вызова.
 *
 * Пересмотр 2026-04-20 (сохранён):
 *   - План счетов: 04, 08, 51, 58, 80, 86.
 *   - Коммит РИД разделён на `o.cap.commit` (Dr 08/Cr 80) и `o.cap.accept`
 *     (Dr 04/Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID).
 *   - WALLET_ONLY: только wallet-движение, без Dr/Cr (для `o.cap.invest`).
 *   - Миграционные операции — namespace `operations::migration`.
 *
 * Реестр — строго хардкод. Новая операция требует релиза контракта.
 * На один `code` приходится ровно одна запись в `OPERATION_REGISTRY` и
 * атомарно одно движение кошелька + (для Dr/Cr-операций) одна пара проводок.
 *
 * Именование eosio::name:
 *   - `o.<contract>.<verb>`, до 12 символов (13-й символ eosio::name имеет
 *     ограничения по алфавиту — избегаем заранее).
 *   - Префиксы контрактов: `reg`, `wal` (сокр. wallet), `cap`, `mkt`, `sov`, `mig`.
 *
 * @ingroup public_ledger2_consts
 */
namespace operations {

  // registrator
  namespace registrator {
    inline constexpr eosio::name PAY_ENTRANCE  = "o.reg.payent"_n;  ///< Оплата вступительного взноса (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES).
    inline constexpr eosio::name PUT_MINSHARE  = "o.reg.putmin"_n;  ///< Внесение минимального паевого при регистрации (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND).
  }

  // wallet
  namespace wallet {
    inline constexpr eosio::name COMPLETE_DEPOSIT  = "o.wal.depcpl"_n;  ///< Завершение внесения паевого взноса (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY).
    inline constexpr eosio::name COMPLETE_WITHDRAW = "o.wal.wthcpl"_n;  ///< Завершение возврата паевого взноса (Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → WITHDRAWALS_SINK).
  }

  // capital
  namespace capital {
    inline constexpr eosio::name IMPORT           = "o.cap.import"_n;   ///< Оффлайн-импорт пайщика Благорост (Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST).
    inline constexpr eosio::name INVEST           = "o.cap.invest"_n;   ///< Инвестиция в ЦПП Благорост (WALLET_ONLY TRANSFER 2001 → 9001).
    inline constexpr eosio::name COMMIT_RID       = "o.cap.commit"_n;   ///< Коммит РИД (Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT).
    inline constexpr eosio::name ACCEPT_RID       = "o.cap.accept"_n;   ///< Приём РИД в НМА (Dr 04 / Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID).
    inline constexpr eosio::name ACCEPT_PROPERTY  = "o.cap.actprp"_n;   ///< Акт-2 имущественный паевой взнос (Dr 51 / Cr 80, ISSUE BLAGOROST_PROPERTY).
    inline constexpr eosio::name LEND             = "o.cap.lend"_n;     ///< Выдача беспроцентного займа пайщику (Dr 58 / Cr 51, ISSUE LOAN_ISSUED).
    inline constexpr eosio::name REPAY            = "o.cap.repay"_n;    ///< Возврат займа пайщика по акту-2 (Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY).
  }

  // marketplace
  namespace marketplace {
    inline constexpr eosio::name CONFIRM_SUPPLY   = "o.mkt.supply"_n;   ///< Подтверждение поставки (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY).
    inline constexpr eosio::name CONFIRM_RECEIPT  = "o.mkt.recv"_n;     ///< Подтверждение получения (Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS).
  }

  // soviet
  namespace soviet {
    inline constexpr eosio::name CONVERT_AXN      = "o.sov.axncnv"_n;   ///< Трансляция паевого взноса в членский (Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES).
  }

  // migration (только из migrate.cpp)
  //
  // В OPERATION_REGISTRY включены **только** те транзиты, которые проводятся
  // через `ledger::accounts` (51/80/86). Программные кошельки soviet::progwallets
  // (Благорост, Генератор) мигрируются отдельным прямым `wallets2.emplace`
  // в migrate.cpp — БЕЗ бух-проводок, поскольку в legacy::ledger::accounts
  // этих сумм нет (soviet::progwallets и ledger::accounts — параллельные
  // системы учёта, не синхронизированные).
  namespace migration {
    inline constexpr eosio::name MIN_SHARE        = "o.mig.minshr"_n;   ///< Перенос: минимальный паевой взнос (Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND).
    inline constexpr eosio::name SHARE            = "o.mig.share"_n;    ///< Перенос: остаток паевых деньгами (Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY).
    inline constexpr eosio::name ENTRY            = "o.mig.entry"_n;    ///< Перенос: вступительные (Dr 51 / Cr 86, ISSUE ENTRANCE_FEES).
    inline constexpr eosio::name RID              = "o.mig.rid"_n;      ///< Перенос: РИД в НМА (Dr 04 / Cr 80, ISSUE SHARE_FUND_RID).
  }

  // adjustment (ручные корректировки председателя)
  //
  // Не входят в OPERATION_REGISTRY: их параметры (wallet_from/to,
  // debit/credit_account_id) задаются динамически каждый вызов, что несовместимо
  // со static_assert проверками реестра. Выполняются отдельными actions:
  //   - ledger2::walmove — WALMOVE: перевод между кошельками одного бух.счёта;
  //   - ledger2::revert  — REVERSAL: зеркальная проводка по operation_id оригинала.
  // Для UI human_name → см. OPERATION_ADJUSTMENT_REGISTRY ниже.
  namespace adjustment {
    inline constexpr eosio::name WALMOVE  = "o.adj.walmove"_n;          ///< Перевод между кошельками внутри одного бух.счёта (без Dr/Cr).
    inline constexpr eosio::name REVERSAL = "o.adj.rev"_n;              ///< Откат операции: зеркальная проводка по operation_id.
  }

} // namespace operations

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
  REVOKE      = 5, ///< изъятие amount с wallet_from без увеличения куда-либо (зеркало ISSUE для o.adj.rev)
};

/**
 * @brief Описание одной именованной операции.
 *
 * Для WALLET_ONLY поля `debit_account_id` / `credit_account_id` равны 0
 * (compile-time валидацией ниже). Для ISSUE `wallet_from = eosio::name{}`,
 * для BLOCK/UNBLOCK/REVOKE `wallet_to = eosio::name{}`.
 */
struct OperationRegistryEntry {
  eosio::name    code;               ///< operation_code с префиксом `o.<contract>.<verb>`
  eosio::name    process_type;       ///< тип процесса с префиксом `p.<contract>.<noun>`
  WalletOp       wallet_op;
  eosio::name    wallet_from;        ///< пустое имя для ISSUE
  eosio::name    wallet_to;          ///< пустое имя для BLOCK/UNBLOCK/REVOKE
  uint64_t       debit_account_id;   ///< 0 для WALLET_ONLY
  uint64_t       credit_account_id;  ///< 0 для WALLET_ONLY
  const char*    human_name;
};

/**
 * @brief Хардкод-реестр именованных операций.
 *
 * Порядок записей не важен (линейный поиск в ledger2::apply).
 */
static constexpr OperationRegistryEntry OPERATION_REGISTRY[] = {
  // 1. Вступительный взнос: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { operations::registrator::PAY_ENTRANCE, processes::registrator::ACCEPT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Вступительный взнос пайщика" },

  // 2. Минимальный паевой взнос (при регистрации): Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { operations::registrator::PUT_MINSHARE, processes::registrator::ACCEPT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Минимальный паевой взнос пайщика при регистрации" },

  // 3. Внесение паевого взноса: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { operations::wallet::COMPLETE_DEPOSIT, processes::wallet::DEPOSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Внесение пайщиком паевого взноса" },

  // 4. Возврат паевого взноса: Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → WITHDRAWALS_SINK
  { operations::wallet::COMPLETE_WITHDRAW, processes::wallet::WITHDRAW, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::WITHDRAWALS_SINK,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Возврат паевого взноса пайщику" },

  // 5. Импорт пайщика Благорост (offline): Dr 51 / Cr 80, ISSUE BLAGOROST_INVEST
  { operations::capital::IMPORT, processes::capital::IMPORT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::BLAGOROST_INVEST,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Паевой взнос по целевой потребительской программе «Благорост» (офлайн-импорт)" },

  // 6. Инвестиция из Цифрового Кошелька в Благорост: WALLET_ONLY TRANSFER 2001 → 9001
  { operations::capital::INVEST, processes::capital::INVEST, WalletOp::WALLET_ONLY,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::BLAGOROST_INVEST,
    0, 0,
    "Инвестиция в ЦПП «Благорост» (перенос между кошельками паевого фонда)" },

  // 7. Коммит РИД: Dr 08 / Cr 80, ISSUE GENERATOR_COMMIT
  { operations::capital::COMMIT_RID, processes::capital::RID, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::GENERATOR_COMMIT,
    ledger2_accounts::NON_CURRENT_INVESTMENTS, ledger2_accounts::SHARE_FUND,
    "Коммит результата интеллектуальной деятельности по программе «Благорост»" },

  // 8. Приём РИД в НМА: Dr 04 / Cr 08, TRANSFER GENERATOR_COMMIT → BLAGOROST_RID
  { operations::capital::ACCEPT_RID, processes::capital::RID, WalletOp::TRANSFER,
    ledger2_wallets::GENERATOR_COMMIT, ledger2_wallets::BLAGOROST_RID,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::NON_CURRENT_INVESTMENTS,
    "Приём результата интеллектуальной деятельности в паевой фонд" },

  // 9. Акт-2 имущественный паевой взнос: Dr 51 / Cr 80, ISSUE BLAGOROST_PROPERTY
  { operations::capital::ACCEPT_PROPERTY, processes::capital::PROPERTY, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::BLAGOROST_PROPERTY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Паевой взнос (не денежный) по программе «Благорост»" },

  // 10. Выдача беспроцентного займа пайщику: Dr 58 / Cr 51, ISSUE LOAN_ISSUED
  { operations::capital::LEND, processes::capital::DEBT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::LOAN_ISSUED,
    ledger2_accounts::FINANCIAL_INVESTMENTS, ledger2_accounts::BANK_ACCOUNT,
    "Выдача пайщику беспроцентного займа" },

  // 11. Возврат займа по акту-2: Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY
  { operations::capital::REPAY, processes::capital::RID, WalletOp::TRANSFER,
    ledger2_wallets::LOAN_ISSUED, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::FINANCIAL_INVESTMENTS,
    "Возврат беспроцентного займа пайщика по акту-2" },

  // 12. Подтверждение поставки: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { operations::marketplace::CONFIRM_SUPPLY, processes::marketplace::REQUEST, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Подтверждение поставки товара/услуги" },

  // 13. Подтверждение получения: Dr 80 / Cr 51, TRANSFER SHARE_FUND_PAY → SUPPLIER_PAYMENTS
  { operations::marketplace::CONFIRM_RECEIPT, processes::marketplace::REQUEST, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::SUPPLIER_PAYMENTS,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::BANK_ACCOUNT,
    "Подтверждение получения товара/услуги — выплата поставщику" },

  // 14. Конвертация в AXN: Dr 80 / Cr 86, TRANSFER SHARE_FUND_PAY → DELEGATE_FEES
  { operations::soviet::CONVERT_AXN, processes::soviet::AXN_CONVERT, WalletOp::TRANSFER,
    ledger2_wallets::SHARE_FUND_PAY, ledger2_wallets::DELEGATE_FEES,
    ledger2_accounts::SHARE_FUND, ledger2_accounts::TARGET_RECEIPTS,
    "Трансляция паевого взноса из ЦПП «Цифровой Кошелёк» в членский взнос за пользование инфраструктурой" },

  // ----- Миграционные (o.mig.*) — вызываются только из migrate.cpp -----

  // 15. Миграция: минимальный паевой: Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND
  { operations::migration::MIN_SHARE, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::MIN_SHARE_FUND,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: минимальные паевые взносы при миграции" },

  // 16. Миграция: остаток паевых деньгами: Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY
  { operations::migration::SHARE, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_PAY,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: остаток паевых взносов деньгами при миграции" },

  // 17. Миграция: вступительные: Dr 51 / Cr 86, ISSUE ENTRANCE_FEES
  { operations::migration::ENTRY, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::ENTRANCE_FEES,
    ledger2_accounts::BANK_ACCOUNT, ledger2_accounts::TARGET_RECEIPTS,
    "Транзитный перенос: вступительные взносы при миграции" },

  // 18. Миграция: РИД в НМА: Dr 04 / Cr 80, ISSUE SHARE_FUND_RID
  { operations::migration::RID, processes::migration::TRANSIT, WalletOp::ISSUE, eosio::name{}, ledger2_wallets::SHARE_FUND_RID,
    ledger2_accounts::INTANGIBLE_ASSETS, ledger2_accounts::SHARE_FUND,
    "Транзитный перенос: принятые РИД в паевой фонд при миграции" },
};

static constexpr size_t OPERATION_REGISTRY_SIZE = sizeof(OPERATION_REGISTRY) / sizeof(OPERATION_REGISTRY[0]);

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
  constexpr bool operation_codes_unique() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < OPERATION_REGISTRY_SIZE; ++j) {
        if (OPERATION_REGISTRY[i].code == OPERATION_REGISTRY[j].code) return false;
      }
    }
    return true;
  }

  constexpr bool dr_ne_cr_when_posting() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op == WalletOp::WALLET_ONLY) continue;
      if (e.debit_account_id == e.credit_account_id) return false;
    }
    return true;
  }

  constexpr bool wallet_only_has_zero_accounts() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op != WalletOp::WALLET_ONLY) continue;
      if (e.debit_account_id != 0 || e.credit_account_id != 0) return false;
    }
    return true;
  }

  constexpr bool transfer_wallet_from_ne_to() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op == WalletOp::TRANSFER || e.wallet_op == WalletOp::WALLET_ONLY) {
        if (e.wallet_from == e.wallet_to) return false;
        if (e.wallet_from.value == 0 || e.wallet_to.value == 0) return false;
      }
    }
    return true;
  }

  constexpr bool accounts_exist_in_map() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_op == WalletOp::WALLET_ONLY) continue;
      if (ledger2_find_account_meta(e.debit_account_id) == nullptr) return false;
      if (ledger2_find_account_meta(e.credit_account_id) == nullptr) return false;
    }
    return true;
  }

  constexpr bool wallets_exist_in_registry() {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      const auto& e = OPERATION_REGISTRY[i];
      if (e.wallet_from.value != 0 && !ledger2_is_known_wallet(e.wallet_from)) return false;
      if (e.wallet_to.value   != 0 && !ledger2_is_known_wallet(e.wallet_to))   return false;
    }
    return true;
  }
}

static_assert(ledger2_registry_detail::operation_codes_unique(),
              "OPERATION_REGISTRY: duplicate operation_code detected");
static_assert(ledger2_registry_detail::dr_ne_cr_when_posting(),
              "OPERATION_REGISTRY: debit_account_id == credit_account_id (self-posting) на non-WALLET_ONLY записи");
static_assert(ledger2_registry_detail::wallet_only_has_zero_accounts(),
              "OPERATION_REGISTRY: WALLET_ONLY запись с ненулевыми debit/credit");
static_assert(ledger2_registry_detail::transfer_wallet_from_ne_to(),
              "OPERATION_REGISTRY: TRANSFER/WALLET_ONLY с wallet_from == wallet_to");
static_assert(ledger2_registry_detail::accounts_exist_in_map(),
              "OPERATION_REGISTRY: ссылка на account id вне LEDGER2_ACCOUNT_MAP");
static_assert(ledger2_registry_detail::wallets_exist_in_registry(),
              "OPERATION_REGISTRY: ссылка на wallet id вне LEDGER2_WALLET_REGISTRY");

/**
 * @brief Линейный поиск записи реестра по operation_code.
 */
inline const OperationRegistryEntry* find_operation(eosio::name operation_code) {
  for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
    if (OPERATION_REGISTRY[i].code == operation_code) {
      return &OPERATION_REGISTRY[i];
    }
  }
  return nullptr;
}

// =====================================================================
// Adjustment-операции (ручные корректировки) — отдельный мини-реестр.
// =====================================================================
//
// Зачем отдельно: у adjustment-операций wallet_from/wallet_to и
// debit/credit_account_id заполняются ДИНАМИЧЕСКИ при каждом вызове
// (определяются параметрами walmove/revert, не справочником). В
// OPERATION_REGISTRY их положить нельзя — сломаются static_assert
// (transfer_wallet_from_ne_to: 0==0, dr_ne_cr_when_posting и пр.).
//
// Здесь — только code + process_type + human_name для UI/audit
// (cooptypes mirror живёт в src/ledger2/operations.ts → addAdjustment).
struct OperationAdjustmentEntry {
  eosio::name      code;
  eosio::name      process_type;
  std::string_view human_name;
};

inline constexpr std::array<OperationAdjustmentEntry, 2> OPERATION_ADJUSTMENT_REGISTRY = {{
  { operations::adjustment::WALMOVE,  processes::adjustment::CORRECTION, "Перевод между кошельками" },
  { operations::adjustment::REVERSAL, processes::adjustment::CORRECTION, "Откат операции" },
}};

inline constexpr const OperationAdjustmentEntry* find_adjustment(eosio::name operation_code) {
  for (size_t i = 0; i < OPERATION_ADJUSTMENT_REGISTRY.size(); ++i) {
    if (OPERATION_ADJUSTMENT_REGISTRY[i].code == operation_code) {
      return &OPERATION_ADJUSTMENT_REGISTRY[i];
    }
  }
  return nullptr;
}
