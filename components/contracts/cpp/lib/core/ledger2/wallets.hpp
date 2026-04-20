#pragma once

#include <array>
#include <cstdint>
#include <string_view>

/**
 * @brief Стандарт кошельков ledger2 (пересмотр 2026-04-20).
 *
 * Кошельки ledger2 — это аналитические разрезы бухгалтерских счетов:
 * «куда/откуда движутся средства» на уровне ЦПП и фондов. Учёт остатков
 * денежных средств (счёт 51) живёт на accounts2 через двойную запись;
 * отдельного «зеркального» wallet-а для 51 НЕТ — любая money-in операция
 * сразу адресуется целевому кошельку-назначению.
 *
 * Нумерация — ×1000, группы:
 *   2xxx — Паевой фонд (журнал Cr 80)
 *   3xxx — Целевое финансирование (Cr 86)
 *   4xxx — Выплаты / обязательства / финансовые вложения (sinks, loans)
 *   5xxx — Служебные (ручные корректировки)
 *   9xxx — ЦПП «Благорост»
 *   10xxx — ЦПП «Генератор» (промежуточное состояние коммитов, Dr 08)
 *   11xxx — ЦПП «Marketplace» (резерв)
 *
 * Пересмотр 2026-04-20:
 *   - Удалён 1001 CASH_MAIN: 51-й счёт ведётся только в accounts2.
 *   - Удалены 4050 LOAN_RECEIVED / 4052 DEBT_CLOSED_SINK: счёт 67 убран,
 *     займы идут через 58 (cap.loanissue: Dr 58 / Cr 51; cap.loanrepay:
 *     Dr 80 / Cr 58).
 *   - Добавлены 9001-9004 Благорост и 10001-10002 Генератор для разнесения
 *     инвестиций/имущества/коммитов по программам.
 *   - Добавлен 5001 MANUAL_ADJUST — резерв под ручные корректировки
 *     (action ledger2::adjust, не реализован в MVP).
 *
 * При первом ISSUE/TRANSFER кошелёк создаётся автоматически по имени
 * из WALLET_REGISTRY. При обнулении available+blocked запись удаляется.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_wallets {
  // Группа 2xxx — паевой фонд (Cr 80)
  static constexpr uint64_t SHARE_FUND_PAY       = 2001;   ///< ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
  static constexpr uint64_t MIN_SHARE_FUND       = 2002;   ///< Минимальный паевой взнос (при регистрации)
  static constexpr uint64_t SHARE_FUND_RID       = 2003;   ///< Паевой фонд — РИД, принятые в НМА (Dr 04 / Cr 80)

  // Группа 3xxx — целевое финансирование (Cr 86)
  static constexpr uint64_t ENTRANCE_FEES        = 3001;   ///< Вступительные взносы
  static constexpr uint64_t MEMBERSHIP_FEES      = 3002;   ///< Членские взносы (платформенные)
  static constexpr uint64_t DELEGATE_FEES        = 3003;   ///< Делегатские членские взносы (цель CONVERT_TO_AXN)

  // Группа 4xxx — выплаты / обязательства / финансовые вложения
  static constexpr uint64_t WITHDRAWALS_SINK     = 4001;   ///< Возвраты паевых взносов (цель WITHDRAW_COMPLETE)
  static constexpr uint64_t SUPPLIER_PAYMENTS    = 4002;   ///< Выплаты поставщикам (цель RECEIVE_CONFIRM)
  static constexpr uint64_t LOAN_ISSUED          = 4051;   ///< Выданные пайщикам беспроцентные займы (Dr 58 / Cr 51)

  // Группа 5xxx — служебные
  static constexpr uint64_t MANUAL_ADJUST        = 5001;   ///< Ручные корректировки (резерв под ledger2::adjust)

  // Группа 9xxx — ЦПП «Благорост»
  static constexpr uint64_t BLAGOROST_INVEST     = 9001;   ///< Благорост — инвестиции деньгами
  static constexpr uint64_t BLAGOROST_RID        = 9002;   ///< Благорост — принятые РИД (Dr 04 / Cr 08 после accept)
  static constexpr uint64_t BLAGOROST_PROPERTY   = 9003;   ///< Благорост — имущественные паевые взносы
  static constexpr uint64_t BLAGOROST_MEMBERSHIP = 9004;   ///< Благорост — членские взносы по программе (Cr 86)

  // Группа 10xxx — ЦПП «Генератор» (промежуточное состояние Dr 08)
  static constexpr uint64_t GENERATOR_COMMIT     = 10001;  ///< Генератор — паевой взнос имуществом в статусе «принятый коммит» (Dr 08 / Cr 80)
  static constexpr uint64_t GENERATOR_MEMBERSHIP = 10002;  ///< Генератор — членские взносы по программе (Cr 86)

  // Группа 11xxx — ЦПП «Marketplace» (резерв)
  static constexpr uint64_t MARKETPLACE_FUND     = 11001;  ///< Marketplace — общий кошелёк программы (пустой в MVP)
};

/**
 * @brief Справочник кошелька: id → имя.
 *
 * `constexpr std::array` + `string_view` — без dynamic init в WASM.
 */
struct Ledger2WalletMeta {
  uint64_t         id;
  std::string_view name;
};

inline constexpr std::array<Ledger2WalletMeta, 17> LEDGER2_WALLET_REGISTRY = {{
  { ledger2_wallets::SHARE_FUND_PAY,       "ЦПП «Цифровой Кошелёк» — паевые взносы деньгами" },
  { ledger2_wallets::MIN_SHARE_FUND,       "Минимальный паевой взнос" },
  { ledger2_wallets::SHARE_FUND_RID,       "Паевой фонд — принятые РИД" },
  { ledger2_wallets::ENTRANCE_FEES,        "Вступительные взносы" },
  { ledger2_wallets::MEMBERSHIP_FEES,      "Членские взносы (платформенные)" },
  { ledger2_wallets::DELEGATE_FEES,        "Делегатские членские взносы" },
  { ledger2_wallets::WITHDRAWALS_SINK,     "Возвраты паевых взносов пайщикам" },
  { ledger2_wallets::SUPPLIER_PAYMENTS,    "Выплаты поставщикам" },
  { ledger2_wallets::LOAN_ISSUED,          "Выданные пайщикам беспроцентные займы" },
  { ledger2_wallets::MANUAL_ADJUST,        "Ручные корректировки" },
  { ledger2_wallets::BLAGOROST_INVEST,     "ЦПП «Благорост» — инвестиции деньгами" },
  { ledger2_wallets::BLAGOROST_RID,        "ЦПП «Благорост» — принятые РИД" },
  { ledger2_wallets::BLAGOROST_PROPERTY,   "ЦПП «Благорост» — имущественные паевые взносы" },
  { ledger2_wallets::BLAGOROST_MEMBERSHIP, "ЦПП «Благорост» — членские взносы" },
  { ledger2_wallets::GENERATOR_COMMIT,     "ЦПП «Генератор» — принятый коммит (имущество)" },
  { ledger2_wallets::GENERATOR_MEMBERSHIP, "ЦПП «Генератор» — членские взносы" },
  { ledger2_wallets::MARKETPLACE_FUND,     "ЦПП «Marketplace» — общий кошелёк" },
}};

static constexpr size_t LEDGER2_WALLET_REGISTRY_SIZE = LEDGER2_WALLET_REGISTRY.size();

// Compile-time проверка уникальности id кошельков.
namespace ledger2_wallets_detail {
  constexpr bool wallet_ids_unique() {
    for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < LEDGER2_WALLET_REGISTRY_SIZE; ++j) {
        if (LEDGER2_WALLET_REGISTRY[i].id == LEDGER2_WALLET_REGISTRY[j].id) return false;
      }
    }
    return true;
  }
}

static_assert(ledger2_wallets_detail::wallet_ids_unique(),
              "LEDGER2_WALLET_REGISTRY: duplicate wallet id detected");

inline constexpr std::string_view ledger2_get_wallet_name_by_id(uint64_t wallet_id) {
  for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
    if (LEDGER2_WALLET_REGISTRY[i].id == wallet_id) return LEDGER2_WALLET_REGISTRY[i].name;
  }
  return std::string_view{};
}
