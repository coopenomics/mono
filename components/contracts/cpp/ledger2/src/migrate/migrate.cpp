/**
 * @brief Одноразовая миграция остатков с ledger на ledger2.
 *
 * Перебирает все кооперативы из registrator::coops и для каждого:
 *   - читает таблицу ledger::accounts (laccount: id, name, available, blocked, writeoff);
 *   - для каждой записи с available+blocked > 0 создаёт запись в ledger2::wallets
 *     с id = старый account id, name = старое имя. Поле writeoff игнорируется.
 *
 * Накопительные таблицы journal / operations / accounts (двойные проводки)
 * при миграции НЕ заполняются — они нарастают только от новых apply-вызовов.
 *
 * Защита от повторного запуска: таблица meta (scope = _ledger2) с флагом migrated.
 *
 * @ingroup public_ledger2_actions
 */
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

    // Старые счета ledger хранятся в multi_index<"accounts", laccount> со scope = coopname
    laccounts_index old_accounts(_ledger, coopname.value);
    wallets2_index  new_wallets(get_self(), coopname.value);

    for (auto acc_it = old_accounts.begin(); acc_it != old_accounts.end(); ++acc_it) {
      eosio::asset total_balance = acc_it->available + acc_it->blocked;
      if (total_balance.amount == 0) continue; // только ненулевые; writeoff игнорируем

      // Создаём/обновляем кошелёк с тем же id (простая совместимость)
      auto wallet_it = new_wallets.find(acc_it->id);
      if (wallet_it == new_wallets.end()) {
        new_wallets.emplace(get_self(), [&](auto& w) {
          w.id        = acc_it->id;
          w.name      = acc_it->name;
          w.available = acc_it->available;
          w.blocked   = acc_it->blocked;
        });
      } else {
        new_wallets.modify(wallet_it, get_self(), [&](auto& w) {
          w.available = acc_it->available;
          w.blocked   = acc_it->blocked;
        });
      }
    }

    ++processed_coops;
  }

  // Ставим флаг миграции
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
