#pragma once

#include <array>
#include <cstdint>
#include <string_view>

#include <eosio/eosio.hpp>

/**
 * @brief Стандарт кошельков ledger2 (пересмотр 2026-05-05 — финальный реестр + WalletKind).
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
 *   w.mkt.* — Маркетплейс (выплаты поставщикам)
 *
 * Sentinel `eosio::name{}` (пустое имя, value=0) — «кошелёк вне системы»
 * для ISSUE (нет wallet_from) и для BURN/BLOCK/UNBLOCK (нет wallet_to).
 *
 * При первом ISSUE/TRANSFER кошелёк создаётся автоматически по записи
 * из WALLET_REGISTRY. При обнулении available+blocked запись удаляется.
 *
 * Классификация `WalletKind` (ADR-002):
 *   USER_SHARED  — обязателен L3-разрез по пайщику (`ledger2::userwallets`).
 *   COOPERATIVE  — единый кооперативный баланс, без L3.
 *
 * Связь L2↔L3 (ADR-010): отдельный enum имён для L3 не вводится — таблица
 * `userwallets` хранит `wallet_name`, ссылающийся на этот же реестр; запись
 * L3 разрешена только для `kind == USER_SHARED`.
 *
 * @ingroup public_ledger2_consts
 */
struct ledger2_wallets {
  // wallet — паевой фонд + возвраты + ЦК
  static constexpr eosio::name SHARE_FUND_PAY       = "w.wal.share"_n;   ///< Паевой взнос пайщика (USER_SHARED)
  static constexpr eosio::name CK_MEMBER            = "w.wal.member"_n;  ///< ЦК — членская часть пайщика (USER_SHARED)
  static constexpr eosio::name WITHDRAWALS_SINK     = "w.wal.wthdrw"_n;  ///< Возвраты паевых взносов пайщикам (sink TRANSFER, COOPERATIVE)

  // registrator — минимальный паевой + вступительные
  static constexpr eosio::name MIN_SHARE_FUND       = "w.reg.minshr"_n;  ///< Минимальный паевой взнос пайщика (USER_SHARED, без сверки соглашений)
  static constexpr eosio::name ENTRANCE_FEES        = "w.reg.entry"_n;   ///< Вступительные взносы (Cr 86, COOPERATIVE)

  // soviet — членские (инфраструктура) + делегатские + хоз.расходы
  static constexpr eosio::name INFRA_FEES           = "w.sov.infra"_n;   ///< Членские взносы за инфраструктуру кооп. платформы (COOPERATIVE)
  static constexpr eosio::name DELEGATE_FEES        = "w.sov.delgte"_n;  ///< Делегатские членские взносы (цель CONVERT_TO_AXN, COOPERATIVE)
  static constexpr eosio::name SOV_EXPENSES         = "w.sov.expns"_n;   ///< Хозяйственные расходы из числа целевого финансирования (COOPERATIVE)

  // capital — единые программные кошельки + займы + пред-импорт
  static constexpr eosio::name LOAN_ISSUED          = "w.cap.loan"_n;    ///< Выданные пайщикам беспроцентные займы (COOPERATIVE; Dr 58 / Cr 51)
  static constexpr eosio::name BLAGOROST_FUND       = "w.cap.blago"_n;   ///< Благорост — единый агрегированный кошелёк программы (USER_SHARED; ADR-009)
  static constexpr eosio::name GENERATOR_FUND       = "w.cap.gen"_n;     ///< Генератор — единый агрегированный кошелёк программы (USER_SHARED; ADR-009)
  static constexpr eosio::name PREIMP_FUND          = "w.cap.preimp"_n;  ///< Первичный учёт РИД-взносов до перехода на электронный учёт (USER_SHARED; o.cap.preimp / o.cap.drppre)

  // marketplace — выплаты
  static constexpr eosio::name SUPPLIER_PAYMENTS    = "w.mkt.payout"_n;  ///< Выплаты поставщикам (sink RECEIVE_CONFIRM, COOPERATIVE)
};

/**
 * @brief Тип кошелька второго уровня (ADR-002).
 *
 * USER_SHARED — обязателен L3-разрез по пайщику (`ledger2::userwallets`),
 *               `walletop` требует параметр `username` (Эпик 3).
 * COOPERATIVE  — единый кооперативный баланс, без L3.
 *
 * `WalletKind` обязателен для каждой записи `LEDGER2_WALLET_REGISTRY`
 * (поле без default — попытка добавить элемент без `kind` ломает сборку).
 */
enum class WalletKind : uint8_t {
  USER_SHARED  = 0,
  COOPERATIVE  = 1,
};

/**
 * @brief Справочник кошелька: machine name → human-readable name + kind.
 *
 * `constexpr std::array` + `string_view` — без dynamic init в WASM.
 */
struct Ledger2WalletMeta {
  eosio::name      name;
  std::string_view human_name;
  WalletKind       kind;
};

inline constexpr std::array<Ledger2WalletMeta, 13> LEDGER2_WALLET_REGISTRY = {{
  // USER_SHARED (6) — L3-разрез по пайщику
  { ledger2_wallets::MIN_SHARE_FUND,    "Минимальный паевой взнос",                                 WalletKind::USER_SHARED },
  { ledger2_wallets::SHARE_FUND_PAY,    "Паевой взнос пайщика",                                     WalletKind::USER_SHARED },
  { ledger2_wallets::CK_MEMBER,         "ЦК — членская часть пайщика",                              WalletKind::USER_SHARED },
  { ledger2_wallets::BLAGOROST_FUND,    "ЦПП «Благорост» — единый кошелёк программы у пайщика",     WalletKind::USER_SHARED },
  { ledger2_wallets::GENERATOR_FUND,    "ЦПП «Генератор» — единый кошелёк программы у пайщика",     WalletKind::USER_SHARED },
  { ledger2_wallets::PREIMP_FUND,       "Первичный учёт РИД-взносов до перехода на электронный учёт", WalletKind::USER_SHARED },

  // COOPERATIVE (7) — единый кооперативный баланс, без L3
  { ledger2_wallets::ENTRANCE_FEES,     "Вступительные взносы",                                     WalletKind::COOPERATIVE },
  { ledger2_wallets::WITHDRAWALS_SINK,  "Возвраты паевых взносов пайщикам",                         WalletKind::COOPERATIVE },
  { ledger2_wallets::INFRA_FEES,        "Членские взносы за инфраструктуру кооп. платформы",        WalletKind::COOPERATIVE },
  { ledger2_wallets::DELEGATE_FEES,     "Делегатские членские взносы",                              WalletKind::COOPERATIVE },
  { ledger2_wallets::SOV_EXPENSES,      "Хозяйственные расходы из числа целевого финансирования",   WalletKind::COOPERATIVE },
  { ledger2_wallets::LOAN_ISSUED,       "Выданные пайщикам беспроцентные займы",                    WalletKind::COOPERATIVE },
  { ledger2_wallets::SUPPLIER_PAYMENTS, "Выплаты поставщикам",                                      WalletKind::COOPERATIVE },
}};

static constexpr size_t LEDGER2_WALLET_REGISTRY_SIZE = LEDGER2_WALLET_REGISTRY.size();

// =====================================================================
// Compile-time валидация реестра.
// =====================================================================
//
// Правила (ADR-002):
//  1. Имена уникальны.
//  2. Имена непустые (sentinel `eosio::name{}` запрещён).
//  3. USER_SHARED-имена соответствуют конвенции `w.<3-char-contract>.<verb>`
//     (символ 0 = 'w', символы 1 и 5 = '.').
//
// Полнота поля `kind` обеспечена структурно: в `Ledger2WalletMeta` поле без
// значения по умолчанию — попытка добавить элемент реестра без явного
// `WalletKind` ломает сборку.
namespace ledger2_wallets_detail {
  // base32 кодирование eosio::name (`.12345abcdefghijklmnopqrstuvwxyz`):
  //   '.' = 0
  //   '1'..'5' = 1..5
  //   'a'..'z' = 6..31
  // 64-битное value делится на 12 5-битных позиций (старшие биты — первый символ);
  // 13-й символ (4 младших бита) для финального реестра не используется (имена ≤ 13 символов).
  static constexpr uint8_t CHAR_DOT = 0;   // '.'
  static constexpr uint8_t CHAR_W   = 28;  // 'w' = 6 + ('w' - 'a') = 6 + 22

  constexpr uint8_t decode_char_at(uint64_t value, size_t pos /* 0..11 */) {
    // pos = 0 — старшие 5 бит (биты 59..63)
    return static_cast<uint8_t>((value >> (59 - 5 * pos)) & 0x1F);
  }

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

  // ADR-002: USER_SHARED-имена обязаны соответствовать конвенции `w.<contract>.<verb>`.
  // Конкретно: символ 0 = 'w', символ 1 = '.', символ 5 = '.' (после 3-символьного contract).
  constexpr bool user_shared_naming_convention() {
    for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
      const auto& e = LEDGER2_WALLET_REGISTRY[i];
      if (e.kind != WalletKind::USER_SHARED) continue;
      const uint64_t v = e.name.value;
      if (decode_char_at(v, 0) != CHAR_W)   return false;  // 'w'
      if (decode_char_at(v, 1) != CHAR_DOT) return false;  // '.'
      if (decode_char_at(v, 5) != CHAR_DOT) return false;  // '.' после 3-char contract
    }
    return true;
  }
}

static_assert(ledger2_wallets_detail::wallet_names_unique(),
              "LEDGER2_WALLET_REGISTRY: duplicate wallet name detected");
static_assert(ledger2_wallets_detail::wallet_names_nonempty(),
              "LEDGER2_WALLET_REGISTRY: empty eosio::name (sentinel) не должно быть в реестре");
static_assert(ledger2_wallets_detail::user_shared_naming_convention(),
              "LEDGER2_WALLET_REGISTRY: USER_SHARED-имя не соответствует конвенции `w.<3-char-contract>.<verb>`");

/**
 * @brief Возвращает human-readable имя кошелька по его eosio::name.
 *
 * Возвращает пустой `string_view` для незарегистрированных имён и для пустого
 * имени (sentinel — кошелёк вне системы при ISSUE/BURN).
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

/**
 * @brief Маппинг USER_SHARED-кошелька → требуемый program_id для cross-contract
 * проверки `wallet::users.programs[]` (ADR-004; Story 3.2).
 *
 * Перед операцией на USER_SHARED-кошельке у пайщика должно быть подписано
 * соответствующее программное соглашение в `wallet::users`. Исключение —
 * `w.reg.minshr` (минимальные паевые взносы в момент регистрации, до того
 * как пайщик подпишет ЦК-соглашение).
 *
 * Соответствие program_id ↔ контракт-программа задаётся в lib/consts.hpp:
 *   1 = wallet (ЦК)
 *   3 = source (Генератор)
 *   4 = capital (Благорост)
 */
struct Ledger2WalletProgramMapping {
  eosio::name wallet_name;
  uint64_t    required_program_id; // 0 = исключение (без проверки)
};

inline constexpr std::array<Ledger2WalletProgramMapping, 6> LEDGER2_USER_SHARED_PROGRAM_MAPPING = {{
  { ledger2_wallets::MIN_SHARE_FUND,    0 /* w.reg.minshr — без проверки */    },
  { ledger2_wallets::SHARE_FUND_PAY,    1 /* ЦК */                              },
  { ledger2_wallets::CK_MEMBER,         1 /* ЦК */                              },
  { ledger2_wallets::BLAGOROST_FUND,    4 /* Благорост */                       },
  { ledger2_wallets::GENERATOR_FUND,    3 /* Генератор */                       },
  { ledger2_wallets::PREIMP_FUND,       0 /* w.cap.preimp — РИД-учёт до перехода на электронный учёт, без проверки */ },
}};

/**
 * @brief Возвращает required program_id для USER_SHARED-кошелька.
 *
 * Возвращает 0 если:
 *   - кошелёк не USER_SHARED (запрос не имеет смысла);
 *   - кошелёк USER_SHARED но в списке исключений (например, w.reg.minshr).
 *
 * Если кошелёк USER_SHARED, но его нет в маппинге — `eosio::check(false, ...)`
 * (защита от добавления нового USER_SHARED-кошелька без соответствующей
 * записи в маппинге).
 */
inline uint64_t ledger2_required_program_id(eosio::name wallet_name) {
  for (const auto& m : LEDGER2_USER_SHARED_PROGRAM_MAPPING) {
    if (m.wallet_name == wallet_name) return m.required_program_id;
  }
  // Кошелёк не в маппинге.
  for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
    if (LEDGER2_WALLET_REGISTRY[i].name == wallet_name &&
        LEDGER2_WALLET_REGISTRY[i].kind == WalletKind::USER_SHARED) {
      eosio::check(false,
                   std::string{"ledger2_required_program_id: USER_SHARED-кошелёк "} +
                     wallet_name.to_string() +
                     " не имеет записи в LEDGER2_USER_SHARED_PROGRAM_MAPPING");
    }
  }
  return 0; // не USER_SHARED → без проверки
}

/**
 * @brief Возвращает `WalletKind` кошелька по его `eosio::name` (ADR-002, ADR-010).
 *
 * Для имени, отсутствующего в реестре — `eosio::check(false, ...)` (фейлит tx).
 * Используется на runtime-write-путях, прежде всего в Эпике 3 при walletop с username
 * (валидация подмножества L3 ⊆ L2 USER_SHARED). Здесь же — общий доступ к классификации.
 */
inline WalletKind ledger2_get_wallet_kind(eosio::name wallet_name) {
  for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
    if (LEDGER2_WALLET_REGISTRY[i].name == wallet_name) return LEDGER2_WALLET_REGISTRY[i].kind;
  }
  eosio::check(false, "ledger2_get_wallet_kind: wallet_name отсутствует в LEDGER2_WALLET_REGISTRY");
  return WalletKind::COOPERATIVE; // unreachable
}
