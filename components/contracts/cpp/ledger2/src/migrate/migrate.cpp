/**
 * @brief Одноразовая миграция остатков с legacy-ledger на ledger2.
 *
 * Переносит состояние ДВУХ уровней учёта (кошельки + бухгалтерские счета)
 * по всем кооперативам из registrator::coops за один проход. Legacy-ledger —
 * одноконтурный (laccount с полями available/blocked/writeoff); ledger2 —
 * двухконтурный, поэтому каждый legacy-остаток маппится параллельно:
 *
 *   [laccount.id] → [ledger2::accounts.id] (всегда, пока есть meta)
 *                 → [ledger2::wallets.id]  (если есть целевой фонд)
 *
 * Таблица маппинга — см. PRD, раздел «4.1.6. Маппинг миграции legacy → ledger2»:
 *
 *   51  (Расчётный счёт, A)   → accounts 51000  debit_balance += amount
 *                               (кошелька нет — касса/банк не фонд назначения)
 *   80  (Паевой фонд, P)      → accounts 80000  credit_balance += amount
 *                             + wallets  2 (SHARE_FUND)          +available/+blocked
 *   861 (Вступительные, P)    → accounts 861000 credit_balance += amount
 *                             + wallets  3 (ENTRANCE_FEES)       +available/+blocked
 *   67  (Долгоср. займы, P)   → accounts 67000  credit_balance += amount
 *                             + wallets  6 (LONG_TERM_LOANS)     +available/+blocked
 *   другие legacy id-ы с записью в LEDGER2_ACCOUNT_MAP → accounts только
 *   (debit/credit по AccountType), без кошелька.
 *   legacy id-ы без meta (редкость) → пропускаются целиком.
 *
 * ⚠️ Legacy-ledger — одноконтурный, поэтому сумма дебетов ≠ сумме кредитов
 * после миграции. Это ожидаемо: парные проводки не сохранялись, восстановить
 * их нельзя. Новые apply-вызовы будут добавлять сбалансированные обороты
 * поверх начального состояния.
 *
 * Follow-up миграция (вне скоупа этого action): вычленение минимальных паевых
 * взносов из wallets[SHARE_FUND=2] в wallets[MIN_SHARE_FUND=1] по количеству
 * пайщиков × размер обязательного пая. Бухгалтерскую сторону (accounts 80000)
 * это не трогает — проводка одна и та же (Dr 51 / Cr 80).
 *
 * Поле writeoff legacy-ledger игнорируется целиком (PRD §4.1.2 FR-L-7).
 * Нулевые записи (available + blocked == 0) пропускаются.
 *
 * Защита от повторного запуска: таблица meta (scope = _ledger2) с флагом migrated.
 *
 * @ingroup public_ledger2_actions
 */

namespace {

/**
 * Маппер id legacy-ledger.accounts → id кошелька ledger2.wallets.
 *
 * Возвращает 0 для legacy-счетов, которым не соответствует целевой фонд
 * (касса 50, р/с 51, прочие бух-счета). Для таких счетов миграция заполняет
 * только accounts, но не wallets.
 */
inline uint64_t legacy_to_wallet_id(uint64_t legacy_id) {
  switch (legacy_id) {
    case Ledger::accounts::SHARE_FUND:      return ledger2_wallets::SHARE_FUND;       // 80  → 2
    case Ledger::accounts::ENTRANCE_FEES:   return ledger2_wallets::ENTRANCE_FEES;    // 861 → 3
    case Ledger::accounts::LONG_TERM_LOANS: return ledger2_wallets::LONG_TERM_LOANS;  // 67  → 6
    default:                                return 0;
  }
}

/**
 * Маппер id legacy-ledger.accounts → id ledger2::accounts (смещение *1000).
 * 51 → 51000, 80 → 80000, 861 → 861000 — прямое правило кодирования из PRD §4.1.4.
 */
inline constexpr uint64_t legacy_to_account_id(uint64_t legacy_id) {
  return legacy_id * 1000;
}

} // namespace

void ledger2::migrate() {
  require_auth(get_self());

  ledger2_meta_index meta_tbl(get_self(), get_self().value);
  auto meta_it = meta_tbl.find(0);
  eosio::check(meta_it == meta_tbl.end() || !meta_it->migrated,
               "ledger2: already migrated");

  cooperatives2_index coops(_registrator, _registrator.value);
  uint64_t processed_coops = 0;

  for (auto coop_it = coops.begin(); coop_it != coops.end(); ++coop_it) {
    eosio::name coopname = coop_it->username;

    laccounts_index old_accounts(_ledger, coopname.value);
    wallets2_index  new_wallets (get_self(), coopname.value);
    accounts2_index new_accounts(get_self(), coopname.value);

    for (auto acc_it = old_accounts.begin(); acc_it != old_accounts.end(); ++acc_it) {
      // writeoff намеренно игнорируется (PRD §4.1.2 FR-L-7).
      eosio::asset total_balance = acc_it->available + acc_it->blocked;
      if (total_balance.amount == 0) continue;

      // --- Уровень 2: бухгалтерские счета (обязательно при наличии meta) ---
      const uint64_t new_account_id = legacy_to_account_id(acc_it->id);
      const auto*    meta           = ledger2_find_account_meta(new_account_id);

      if (meta != nullptr) {
        const bool passive = (meta->type == AccountType::PASSIVE);

        auto acc_new_it = new_accounts.find(new_account_id);
        if (acc_new_it == new_accounts.end()) {
          new_accounts.emplace(get_self(), [&](auto& a) {
            a.id             = new_account_id;
            a.name           = meta->name;
            a.account_type   = static_cast<uint8_t>(meta->type);
            a.debit_balance  = eosio::asset(0, total_balance.symbol);
            a.credit_balance = eosio::asset(0, total_balance.symbol);
            // Сальдо legacy-счёта кладём в нужное плечо оборотов:
            //   ACTIVE / ACTIVE_PASSIVE → debit_balance (остаток по дебету)
            //   PASSIVE                 → credit_balance (остаток по кредиту)
            if (passive) a.credit_balance = total_balance;
            else         a.debit_balance  = total_balance;
          });
        } else {
          new_accounts.modify(acc_new_it, get_self(), [&](auto& a) {
            if (passive) a.credit_balance += total_balance;
            else         a.debit_balance  += total_balance;
          });
        }
      }

      // --- Уровень 1: кошельки (только для legacy-id с целевым фондом) ---
      const uint64_t wallet_id = legacy_to_wallet_id(acc_it->id);
      if (wallet_id == 0) continue;

      const std::string wallet_name = ledger2_get_wallet_name_by_id(wallet_id);

      auto wallet_it = new_wallets.find(wallet_id);
      if (wallet_it == new_wallets.end()) {
        new_wallets.emplace(get_self(), [&](auto& w) {
          w.id        = wallet_id;
          w.name      = wallet_name;
          w.available = acc_it->available;
          w.blocked   = acc_it->blocked;
        });
      } else {
        // Агрегация, если несколько legacy-счетов сводятся в один фонд
        // (в MVP таких случаев нет, но защитный «+=» не вредит).
        new_wallets.modify(wallet_it, get_self(), [&](auto& w) {
          w.available += acc_it->available;
          w.blocked   += acc_it->blocked;
        });
      }
    }

    ++processed_coops;
  }

  if (meta_it == meta_tbl.end()) {
    meta_tbl.emplace(get_self(), [&](auto& m) {
      m.id             = 0;
      m.migrated       = true;
      m.migrated_coops = processed_coops;
      m.migrated_at    = eosio::current_time_point();
    });
  } else {
    meta_tbl.modify(meta_it, get_self(), [&](auto& m) {
      m.migrated       = true;
      m.migrated_coops = processed_coops;
      m.migrated_at    = eosio::current_time_point();
    });
  }
}
