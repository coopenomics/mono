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
 * @brief План счетов ledger2 (MVP) со смещением *1000.
 *
 * Пересмотрен 2026-04-20: 99 «Переходные остатки» удалён — миграция идёт
 * прямыми проводками Dr 51/Cr 80/86 и Dr 04|08/Cr 80, без транзитного счёта.
 * Добавлен 08 «Вложения во внеоборотные активы» для промежуточного
 * состояния «принятый коммит» (паевой взнос имуществом в переходе РИД
 * в программу Благорост): commit → Dr 08 / Cr 80, accept → Dr 04 / Cr 08.
 *
 * Состав (6 счетов):
 *
 * - 04  — Нематериальные активы (РИД, принятые в паевой фонд)
 * - 08  — Вложения во внеоборотные активы (промежуточное состояние)
 * - 51  — Расчётный счёт
 * - 58  — Финансовые вложения (выданные пайщикам беспроцентные займы)
 * - 80  — Паевой фонд (складочный капитал)
 * - 86  — Целевое финансирование (без субсчетов)
 *
 * Счёт 67 удалён: беспроцентные займы пайщикам идут через 58/51, без 67.
 *
 * Правило кодирования id: integer(code) * 1000.
 * Детализация — через wallets (см. wallets.hpp).
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_accounts {
  // Активы
  static constexpr uint64_t INTANGIBLE_ASSETS         = 4 * 1000;    ///< 04 — Нематериальные активы (А)
  static constexpr uint64_t NON_CURRENT_INVESTMENTS   = 8 * 1000;    ///< 08 — Вложения во внеоборотные активы (А)
  static constexpr uint64_t BANK_ACCOUNT              = 51 * 1000;   ///< 51 — Расчётный счёт (А)
  static constexpr uint64_t FINANCIAL_INVESTMENTS     = 58 * 1000;   ///< 58 — Финансовые вложения (А)

  // Пассивы
  static constexpr uint64_t SHARE_FUND                = 80 * 1000;   ///< 80 — Паевой фонд (П)
  static constexpr uint64_t TARGET_RECEIPTS           = 86 * 1000;   ///< 86 — Целевое финансирование (П)
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
inline constexpr std::array<Ledger2AccountMeta, 6> LEDGER2_ACCOUNT_MAP = {{
  { ledger2_accounts::INTANGIBLE_ASSETS,       "Нематериальные активы",                 AccountType::ACTIVE },
  { ledger2_accounts::NON_CURRENT_INVESTMENTS, "Вложения во внеоборотные активы",       AccountType::ACTIVE },
  { ledger2_accounts::BANK_ACCOUNT,            "Расчётный счёт",                        AccountType::ACTIVE },
  { ledger2_accounts::FINANCIAL_INVESTMENTS,   "Финансовые вложения",                   AccountType::ACTIVE },
  { ledger2_accounts::SHARE_FUND,              "Паевой фонд (складочный капитал)",      AccountType::PASSIVE },
  { ledger2_accounts::TARGET_RECEIPTS,         "Целевое финансирование",                AccountType::PASSIVE },
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
