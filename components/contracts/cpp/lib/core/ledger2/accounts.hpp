#pragma once

#include <array>
#include <cstdint>
#include <string_view>

/**
 * @brief Тип бухгалтерского счёта.
 *
 * Определяет, как рассчитывается сальдо и как растёт счёт при проводке:
 * - ACTIVE: остаток — дебетовый. Dr ↑ при поступлении, Cr ↑ при расходе.
 *   balance = debit_turnover − credit_turnover.
 * - PASSIVE: остаток — кредитовый. Cr ↑ при начислении, Dr ↑ при погашении.
 *   balance = credit_turnover − debit_turnover.
 * - ACTIVE_PASSIVE: остаток может быть любого знака; возвращаем
 *   debit − credit (положительный → активный остаток, отрицательный → пассивный).
 *
 * @ingroup public_ledger2_consts
 */
enum class AccountType : uint8_t {
  ACTIVE         = 0,
  PASSIVE        = 1,
  ACTIVE_PASSIVE = 2,
};

/**
 * @brief План счетов ledger2 (MVP минимальный) со смещением *1000.
 *
 * Пересмотрен 2026-04-18 (PRD §4.1.6a): субсчета 86.x (861/862/868) убраны
 * полностью — их детализация живёт на уровне кошельков (wallets2) с шагом
 * ×1000 и off-chain-агрегацией. В MVP осталось 7 счетов:
 *
 * - 04  — Нематериальные активы (РИД, принятые в паевой фонд)
 * - 51  — Расчётный счёт
 * - 58  — Финансовые вложения (долги пайщиков, cap.debt) [ТРЕБУЕТ УТОЧНЕНИЯ]
 * - 67  — Расчёты по долгосрочным займам                  [ТРЕБУЕТ УТОЧНЕНИЯ]
 * - 80  — Паевой фонд (складочный капитал)
 * - 86  — Целевое финансирование (без субсчетов)
 * - 99  — Переходные остатки (транзит миграции; сводится к 0 после migrate)
 *
 * Правило кодирования id: integer(code) * 1000 (51 → 51000, 86 → 86000,
 * 99 → 99000 и т.д.). Субсчета не применяются на уровне плана счетов —
 * деталировка через wallets.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_accounts {
  // Активы
  static constexpr uint64_t INTANGIBLE_ASSETS     = 4 * 1000;    ///< 04 — Нематериальные активы (А)
  static constexpr uint64_t BANK_ACCOUNT          = 51 * 1000;   ///< 51 — Расчётный счёт (А)
  static constexpr uint64_t FINANCIAL_INVESTMENTS = 58 * 1000;   ///< 58 — Финансовые вложения (А) [ТРЕБУЕТ УТОЧНЕНИЯ]

  // Пассивы
  static constexpr uint64_t LONG_TERM_LOANS       = 67 * 1000;   ///< 67 — Расчёты по долгосрочным займам (П) [ТРЕБУЕТ УТОЧНЕНИЯ]
  static constexpr uint64_t SHARE_FUND            = 80 * 1000;   ///< 80 — Паевой фонд (П)
  static constexpr uint64_t TARGET_RECEIPTS       = 86 * 1000;   ///< 86 — Целевое финансирование (П)

  // Технические
  static constexpr uint64_t OPENING_TRANSIT       = 99 * 1000;   ///< 99 — Переходные остатки (А-П, транзит миграции)
};

/**
 * @brief Справочник счёта: id → (имя, тип).
 *
 * Покрывает все id, используемые в ACTION_REGISTRY. При первой проводке
 * в соответствующий счёт справочные значения переносятся в запись
 * `accounts2` один раз и дальше хранятся там.
 */
struct Ledger2AccountMeta {
  uint64_t         id;
  std::string_view name;
  AccountType      type;
};

/**
 * @brief Хардкод-справочник плана счетов (MVP, 7 записей).
 *
 * `constexpr std::array` + `string_view` — чтобы не было dynamic init
 * при загрузке контракта и тип был полностью заморожен на этапе сборки.
 */
inline constexpr std::array<Ledger2AccountMeta, 7> LEDGER2_ACCOUNT_MAP = {{
  { ledger2_accounts::INTANGIBLE_ASSETS,     "Нематериальные активы",                      AccountType::ACTIVE },
  { ledger2_accounts::BANK_ACCOUNT,          "Расчётный счёт",                             AccountType::ACTIVE },
  { ledger2_accounts::FINANCIAL_INVESTMENTS, "Финансовые вложения (долги пайщиков)",       AccountType::ACTIVE },
  { ledger2_accounts::LONG_TERM_LOANS,       "Расчёты по долгосрочным кредитам и займам",  AccountType::PASSIVE },
  { ledger2_accounts::SHARE_FUND,            "Паевой фонд (складочный капитал)",           AccountType::PASSIVE },
  { ledger2_accounts::TARGET_RECEIPTS,       "Целевое финансирование",                     AccountType::PASSIVE },
  { ledger2_accounts::OPENING_TRANSIT,       "Переходные остатки (транзит миграции)",      AccountType::ACTIVE_PASSIVE },
}};

static constexpr size_t LEDGER2_ACCOUNT_MAP_SIZE = LEDGER2_ACCOUNT_MAP.size();

// Compile-time проверка уникальности id в справочнике счетов.
namespace ledger2_accounts_detail {
  constexpr bool account_ids_unique() {
    for (size_t i = 0; i < LEDGER2_ACCOUNT_MAP_SIZE; ++i) {
      for (size_t j = i + 1; j < LEDGER2_ACCOUNT_MAP_SIZE; ++j) {
        if (LEDGER2_ACCOUNT_MAP[i].id == LEDGER2_ACCOUNT_MAP[j].id) return false;
      }
    }
    return true;
  }
}

static_assert(ledger2_accounts_detail::account_ids_unique(),
              "LEDGER2_ACCOUNT_MAP: duplicate account id detected");

inline constexpr const Ledger2AccountMeta* ledger2_find_account_meta(uint64_t account_id) {
  for (size_t i = 0; i < LEDGER2_ACCOUNT_MAP_SIZE; ++i) {
    if (LEDGER2_ACCOUNT_MAP[i].id == account_id) return &LEDGER2_ACCOUNT_MAP[i];
  }
  return nullptr;
}

inline std::string_view ledger2_get_account_name_by_id(uint64_t account_id) {
  const auto* meta = ledger2_find_account_meta(account_id);
  return meta ? meta->name : std::string_view{};
}

inline constexpr AccountType ledger2_get_account_type_by_id(uint64_t account_id) {
  const auto* meta = ledger2_find_account_meta(account_id);
  return meta ? meta->type : AccountType::ACTIVE_PASSIVE;
}
