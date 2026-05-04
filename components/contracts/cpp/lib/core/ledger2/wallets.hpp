#pragma once

#include <array>
#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

/**
 * @brief Стандарт кошельков ledger2 (пересмотр 2026-04-27).
 *
 * Кошельки ledger2 — это аналитические разрезы бухгалтерских счетов:
 * «куда/откуда движутся средства» на уровне ЦПП и фондов. Учёт остатков
 * денежных средств (счёт 51) живёт на accounts2 через двойную запись;
 * отдельного «зеркального» wallet-а для 51 НЕТ — любая money-in операция
 * сразу адресуется целевому кошельку-назначению.
 *
 * Идентификатор кошелька — `eosio::name` с префиксом `w.<contract>.<waltype>`
 * (по аналогии с операциями `o.<contract>.<verb>` и процессами
 * `p.<contract>.<noun>`). Длина ≤ 13 base32-символов.
 *
 * Группы:
 *   w.wal.* — Паевой фонд (журнал Cr 80) и возвраты пайщикам
 *   w.reg.* — Регистрация (минимальный паевой, вступительные)
 *   w.sov.* — Целевое финансирование (членские, делегатские)
 *   w.cap.* — Программы паевого фонда (Благорост, Генератор) и займы
 *   w.mkt.* — Маркетплейс (выплаты поставщикам, общий фонд «Стол Заказов»)
 *   w.led.* — Служебные (ручные корректировки)
 *
 * Sentinel `eosio::name{}` (пустое имя, value=0) — «кошелёк вне системы»
 * для ISSUE (нет wallet_from) и REVOKE (нет wallet_to).
 *
 * При первом ISSUE/TRANSFER кошелёк создаётся автоматически по записи
 * из WALLET_REGISTRY. При обнулении available+blocked запись удаляется.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_wallets {
  // wallet — паевой фонд + возвраты
  static constexpr eosio::name SHARE_FUND_PAY       = "w.wal.share"_n;   ///< ЦПП «Цифровой Кошелёк» — паевые взносы деньгами (Cr 80)
  static constexpr eosio::name SHARE_FUND_RID       = "w.wal.sharid"_n;  ///< Паевой фонд — РИД, принятые в НМА (Dr 04 / Cr 80)
  static constexpr eosio::name WITHDRAWALS_SINK     = "w.wal.wthdrw"_n;  ///< Возвраты паевых взносов пайщикам (sink TRANSFER)

  // registrator — минимальный паевой + вступительные
  static constexpr eosio::name MIN_SHARE_FUND       = "w.reg.minshr"_n;  ///< Минимальный паевой взнос при регистрации (Cr 80)
  static constexpr eosio::name ENTRANCE_FEES        = "w.reg.entry"_n;   ///< Вступительные взносы (Cr 86)

  // soviet — членские взносы
  static constexpr eosio::name MEMBERSHIP_FEES      = "w.sov.member"_n;  ///< Членские взносы (платформенные) (Cr 86)
  static constexpr eosio::name DELEGATE_FEES        = "w.sov.delgte"_n;  ///< Делегатские членские взносы (цель CONVERT_TO_AXN) (Cr 86)

  // capital — программы Благорост, Генератор + займы
  static constexpr eosio::name LOAN_ISSUED          = "w.cap.loan"_n;    ///< Выданные пайщикам беспроцентные займы (Dr 58 / Cr 51)
  static constexpr eosio::name BLAGOROST_INVEST     = "w.cap.bginv"_n;   ///< Благорост — инвестиции деньгами (Cr 80)
  static constexpr eosio::name BLAGOROST_RID        = "w.cap.bgrid"_n;   ///< Благорост — принятые РИД (Dr 04 / Cr 08 после accept)
  static constexpr eosio::name BLAGOROST_PROPERTY   = "w.cap.bgprop"_n;  ///< Благорост — имущественные паевые взносы
  static constexpr eosio::name BLAGOROST_MEMBERSHIP = "w.cap.bgmem"_n;   ///< Благорост — членские взносы по программе (Cr 86)
  static constexpr eosio::name GENERATOR_COMMIT     = "w.cap.gncom"_n;   ///< Генератор — паевой взнос имуществом в статусе «принятый коммит» (Dr 08 / Cr 80)
  static constexpr eosio::name GENERATOR_MEMBERSHIP = "w.cap.gnmem"_n;   ///< Генератор — членские взносы по программе (Cr 86)

  // marketplace — выплаты + общий фонд
  static constexpr eosio::name SUPPLIER_PAYMENTS    = "w.mkt.payout"_n;  ///< Выплаты поставщикам (sink RECEIVE_CONFIRM)
  static constexpr eosio::name MARKETPLACE_FUND     = "w.mkt.fund"_n;    ///< ЦПП «Стол Заказов» — общий кошелёк программы (резерв)

  // ledger2 — служебные
  static constexpr eosio::name MANUAL_ADJUST        = "w.led.adjust"_n;  ///< Ручные корректировки (резерв под ledger2::adjust)
};

/**
 * @brief Справочник кошелька: machine name → human-readable name.
 *
 * `constexpr std::array` + `string_view` — без dynamic init в WASM.
 */
struct Ledger2WalletMeta {
  eosio::name      name;
  std::string_view human_name;
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
  { ledger2_wallets::MARKETPLACE_FUND,     "ЦПП «Стол Заказов» — общий кошелёк" },
}};

static constexpr size_t LEDGER2_WALLET_REGISTRY_SIZE = LEDGER2_WALLET_REGISTRY.size();

// Compile-time проверка уникальности имён кошельков.
namespace ledger2_wallets_detail {
  constexpr bool wallet_names_unique() {
    for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
      for (size_t j = i + 1; j < LEDGER2_WALLET_REGISTRY_SIZE; ++j) {
        if (LEDGER2_WALLET_REGISTRY[i].name == LEDGER2_WALLET_REGISTRY[j].name) return false;
      }
    }
    return true;
  }

  constexpr bool wallet_names_nonempty() {
    for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
      if (LEDGER2_WALLET_REGISTRY[i].name.value == 0) return false;
    }
    return true;
  }
}

static_assert(ledger2_wallets_detail::wallet_names_unique(),
              "LEDGER2_WALLET_REGISTRY: duplicate wallet name detected");
static_assert(ledger2_wallets_detail::wallet_names_nonempty(),
              "LEDGER2_WALLET_REGISTRY: empty eosio::name (sentinel) не должно быть в реестре");

/**
 * @brief Возвращает human-readable имя кошелька по его eosio::name.
 *
 * Возвращает пустой `string_view` для незарегистрированных имён и для пустого
 * имени (sentinel — кошелёк вне системы при ISSUE/REVOKE).
 */
inline constexpr std::string_view ledger2_get_wallet_human_name(eosio::name wallet_name) {
  for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
    if (LEDGER2_WALLET_REGISTRY[i].name == wallet_name) return LEDGER2_WALLET_REGISTRY[i].human_name;
  }
  return std::string_view{};
}

/**
 * @brief Проверяет, что `wallet_name` присутствует в LEDGER2_WALLET_REGISTRY.
 */
inline constexpr bool ledger2_is_known_wallet(eosio::name wallet_name) {
  for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
    if (LEDGER2_WALLET_REGISTRY[i].name == wallet_name) return true;
  }
  return false;
}
