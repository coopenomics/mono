/**
 * @brief Одноразовая миграция остатков с ledger на ledger2.
 *
 * Перебирает все кооперативы из registrator::coops и для каждого:
 *   - читает таблицу ledger::accounts (laccount: id, name, available, blocked, writeoff);
 *   - для каждой записи с `available + blocked > 0` упсертит запись в
 *     ledger2::wallets. Legacy-идентификаторы плана счетов (80, 861, 67 …)
 *     маппятся на порядковые id кошельков ledger2 (SHARE_FUND=2, ENTRANCE_FEES=3,
 *     LONG_TERM_LOANS=6 …) — см. legacy_to_wallet_id().
 *   - поле writeoff игнорируется; записи без соответствия в реестре кошельков
 *     (например, Касса/Банк 50, 51) — тоже: бух.учёт кассы/расчётного счёта
 *     живёт в ledger2::accounts и формируется только новыми apply-вызовами.
 *
 * Накопительные таблицы journal / wjournal / accounts (двойные проводки)
 * при миграции НЕ заполняются — они нарастают только от новых apply-вызовов
 * (PRD §4.1.2 FR-L-7).
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
 * в LEDGER2_WALLET_REGISTRY (касса 50, р/с 51, прочие бух-счета). Такие
 * записи пропускаются: их остатки при необходимости восстанавливаются
 * заново двойной записью через apply().
 */
inline uint64_t legacy_to_wallet_id(uint64_t legacy_id) {
  switch (legacy_id) {
    case Ledger::accounts::SHARE_FUND:      return ledger2_wallets::SHARE_FUND;       // 80  → 2
    case Ledger::accounts::ENTRANCE_FEES:   return ledger2_wallets::ENTRANCE_FEES;    // 861 → 3
    case Ledger::accounts::LONG_TERM_LOANS: return ledger2_wallets::LONG_TERM_LOANS;  // 67  → 6
    default:                                return 0;
  }
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
    wallets2_index  new_wallets(get_self(), coopname.value);

    for (auto acc_it = old_accounts.begin(); acc_it != old_accounts.end(); ++acc_it) {
      // writeoff намеренно игнорируется (PRD §4.1.2 FR-L-7)
      eosio::asset total_balance = acc_it->available + acc_it->blocked;
      if (total_balance.amount == 0) continue;

      const uint64_t wallet_id = legacy_to_wallet_id(acc_it->id);
      if (wallet_id == 0) continue; // нет целевого фонда — пропускаем

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
        // (в MVP таких случаев нет, но защитный + на будущее).
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
