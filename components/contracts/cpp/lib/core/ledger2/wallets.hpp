#pragma once

#include <array>
#include <cstdint>
#include <string_view>

/**
 * @brief Стандарт кошельков ledger2 (MVP — пересмотр 2026-04-18).
 *
 * Кошельки ledger2 — это целевые фонды, КУДА/ОТКУДА движутся средства
 * на управленческом уровне. Учёт остатков денежных средств (счёт 51)
 * живёт на уровне accounts2 через двойную запись; wallet 1001
 * `CASH_MAIN` используется как wallet-зеркало счёта 51 при операциях,
 * где второй стороной выступают деньги на расчётном.
 *
 * Нумерация — ×1000, с оставленными «нулевыми» слотами (1000, 2000,
 * 3000, 4000, 9000) под off-chain-агрегацию по группам. Эти слоты
 * НЕ создаются ончейн — агрегаты считает backend суммированием
 * sub-wallets с совпадающим префиксом.
 *
 * Группы:
 *   1xxx — CASH / расчётный
 *   2xxx — Паевой фонд (SHARE_FUND group; журнал Dr ... / Cr 80)
 *   3xxx — Целевое финансирование (TARGET_RECEIPTS group; журнал Dr ... / Cr 86)
 *   4xxx — Выплаты / обязательства (sinks и loans)
 *   5xxx — Служебные (MANUAL_ADJUST — из Epic 5, резерв)
 *   9xxx+ — ЦПП (Целевые программы), по программам ×1000: 9xxx — ЦПП 1,
 *           10xxx — ЦПП 2 и так далее.
 *
 * При первом ISSUE/TRANSFER кошелёк создаётся автоматически по имени
 * из WALLET_REGISTRY. При обнулении available+blocked запись удаляется.
 *
 * Важно: минимальный паевой взнос (2002) и обычный паевой (2001) —
 * разные кошельки с одной бухгалтерской проводкой (Dr 51 / Cr 80).
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_wallets {
  // Группа 1xxx — расчётный (зеркало счёта 51)
  static constexpr uint64_t CASH_MAIN         = 1001;  ///< Расчётный счёт (кошелёк-зеркало 51)

  // Группа 2xxx — паевой фонд (журнал Cr 80)
  static constexpr uint64_t SHARE_FUND_PAY    = 2001;  ///< Паевой фонд — взносы деньгами
  static constexpr uint64_t MIN_SHARE_FUND    = 2002;  ///< Минимальный паевой взнос (при регистрации)
  static constexpr uint64_t SHARE_FUND_RID    = 2003;  ///< Паевой фонд — приём РИД (Dr 04 / Cr 80)

  // Группа 3xxx — целевое финансирование (журнал Cr 86)
  static constexpr uint64_t ENTRANCE_FEES     = 3001;  ///< Вступительные взносы
  static constexpr uint64_t MEMBERSHIP_FEES   = 3002;  ///< Членские взносы
  static constexpr uint64_t DELEGATE_FEES     = 3003;  ///< Фонд делегатов (цель CONVERT_TO_AXN)

  // Группа 4xxx — выплаты и обязательства
  static constexpr uint64_t WITHDRAWALS_SINK  = 4001;  ///< Возвраты паёв (цель WITHDRAW_COMPLETE)
  static constexpr uint64_t SUPPLIER_PAYMENTS = 4002;  ///< Выплаты поставщикам (цель RECEIVE_CONFIRM)
  static constexpr uint64_t LOAN_RECEIVED     = 4050;  ///< Принятые долгосрочные займы (Dr 51 / Cr 67) [ТРЕБУЕТ УТОЧНЕНИЯ]
  static constexpr uint64_t DEBT_CLOSED_SINK  = 4052;  ///< Гашение обязательств по акту-2 (TRANSFER 4050 → 4052) [ТРЕБУЕТ УТОЧНЕНИЯ]
  // Резерв:
  //   4051 — LOAN_GIVEN (Dr 58 / Cr 80, долги пайщиков) — добавить при активации 58.

  // Группа 9xxx — ЦПП (Целевые программы), начиная с 9001
  //   9001-9099 — ЦПП Благорост (9001 основной, 9002 приём РИД, 9003 распределение)
  //   10001-10099 — следующая ЦПП; и так далее.
  // Конкретные ЦПП-кошельки регистрируются по мере появления новых программ.
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

inline constexpr std::array<Ledger2WalletMeta, 11> LEDGER2_WALLET_REGISTRY = {{
  { ledger2_wallets::CASH_MAIN,         "Расчётный счёт (основной)" },
  { ledger2_wallets::SHARE_FUND_PAY,    "Паевой фонд — взносы деньгами" },
  { ledger2_wallets::MIN_SHARE_FUND,    "Минимальный паевой взнос" },
  { ledger2_wallets::SHARE_FUND_RID,    "Паевой фонд — приём РИД" },
  { ledger2_wallets::ENTRANCE_FEES,     "Вступительные взносы" },
  { ledger2_wallets::MEMBERSHIP_FEES,   "Членские взносы" },
  { ledger2_wallets::DELEGATE_FEES,     "Фонд делегатов" },
  { ledger2_wallets::WITHDRAWALS_SINK,  "Возвраты паевых взносов пайщикам" },
  { ledger2_wallets::SUPPLIER_PAYMENTS, "Выплаты поставщикам" },
  { ledger2_wallets::LOAN_RECEIVED,     "Принятые долгосрочные займы" },
  { ledger2_wallets::DEBT_CLOSED_SINK,  "Гашение обязательств кооператива" },
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
