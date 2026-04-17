#pragma once

#include <cstdint>
#include <string>
#include <tuple>
#include <vector>

/**
 * @brief Стандарт кошельков ledger2 (id — простой порядковый).
 *
 * Кошельки ledger2 — это целевые фонды, КУДА выпускаются средства,
 * не бухгалтерские счета денежных средств. Учёт остатков кассы/банка
 * (счёт 51) живёт только на уровне accounts (двойная запись). На
 * уровне кошельков мы отмечаем, в какой фонд зачислены поступления.
 *
 * При первом ISSUE/TRANSFER кошелёк создаётся автоматически по имени
 * из WALLET_REGISTRY. При обнулении available+blocked запись удаляется.
 *
 * Важно: минимальный паевой взнос и обычные паевые — это РАЗНЫЕ
 * кошельки (MIN_SHARE_FUND vs SHARE_FUND). Бухгалтерская проводка у
 * обоих одинаковая (Dr 51 / Cr 80), а фонд назначения разный.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_wallets {
  // Целевые фонды поступлений
  static constexpr uint64_t MIN_SHARE_FUND   = 1;   ///< Минимальные паевые взносы (обязательный пай при регистрации)
  static constexpr uint64_t SHARE_FUND       = 2;   ///< Паевой фонд (добровольные паевые взносы)
  static constexpr uint64_t ENTRANCE_FEES    = 3;   ///< Вступительные взносы
  static constexpr uint64_t MEMBERSHIP_FEES  = 4;   ///< Членские взносы
  static constexpr uint64_t DELEGATE_FEES    = 5;   ///< Членские взносы делегатов
  static constexpr uint64_t LONG_TERM_LOANS  = 6;   ///< Долгосрочные займы (задолженность)

  // Кошельки-накопители («sinks») для моделирования выплат без writeoff
  static constexpr uint64_t WITHDRAWALS_SINK = 10;  ///< Возвраты паёв пайщикам
  static constexpr uint64_t SUPPLIER_PAYMENTS = 11; ///< Выплаты поставщикам маркетплейса
  static constexpr uint64_t DEBT_CLOSED_SINK = 12;  ///< Гашение обязательств кооператива
};

static const std::vector<std::tuple<uint64_t, std::string>> LEDGER2_WALLET_REGISTRY = {
  { ledger2_wallets::MIN_SHARE_FUND,    "Минимальные паевые взносы" },
  { ledger2_wallets::SHARE_FUND,        "Паевой фонд" },
  { ledger2_wallets::ENTRANCE_FEES,     "Вступительные взносы" },
  { ledger2_wallets::MEMBERSHIP_FEES,   "Членские взносы" },
  { ledger2_wallets::DELEGATE_FEES,     "Членские взносы делегатов" },
  { ledger2_wallets::LONG_TERM_LOANS,   "Долгосрочные займы" },
  { ledger2_wallets::WITHDRAWALS_SINK,  "Возвраты паевых взносов пайщикам" },
  { ledger2_wallets::SUPPLIER_PAYMENTS, "Выплаты поставщикам" },
  { ledger2_wallets::DEBT_CLOSED_SINK,  "Гашение обязательств кооператива" },
};

inline std::string ledger2_get_wallet_name_by_id(uint64_t wallet_id) {
  for (const auto& row : LEDGER2_WALLET_REGISTRY) {
    if (std::get<0>(row) == wallet_id) return std::get<1>(row);
  }
  return std::string{};
}
