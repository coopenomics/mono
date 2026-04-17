/**
 * @brief Единая точка входа ledger2 для всех финансовых движений.
 *
 * Два уровня учёта внутри одного вызова apply:
 *   1) Операционный уровень — кошельки (wallets) + журнал wjournal.
 *      Выполняется атомарная операция ISSUE / TRANSFER / BLOCK / UNBLOCK
 *      и её факт фиксируется ровно одной записью в wjournal.
 *   2) Бухгалтерский уровень — счета (accounts) + журнал journal.
 *      Выполняется ровно одна парная проводка Dr/Cr, дебет/кредит
 *      начисляется с учётом активности/пассивности счетов
 *      (AccountType определяется планом счетов LEDGER2_ACCOUNT_MAP).
 *
 * Оба уровня применяются в одной транзакции. Записи в journal и wjournal
 * перекрёстно линкованы: journal.wjournal_entry_id ↔ wjournal.journal_entry_id.
 *
 * Flow:
 *   1. auth: coopname или контракт из whitelist
 *   2. lookup ACTION_REGISTRY по action_code
 *   3. wallet op: изменение кошельков + emplace в wjournal
 *   4. accounts: upsert Dr/Cr (фиксируем AccountType при первой проводке)
 *   5. journal: emplace пары проводок, линк на wjournal_entry_id
 *   6. backfill wjournal.journal_entry_id
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::apply(eosio::name coopname,
                    eosio::name initiator,
                    eosio::name action_code,
                    eosio::asset amount,
                    eosio::name username,
                    eosio::checksum256 document_hash,
                    std::string memo) {
  require_recipient(coopname);

  // -------- auth --------
  eosio::name payer = coopname;
  if (!has_auth(coopname)) {
    payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  // -------- validate amount --------
  eosio::check(amount.is_valid(), "Некорректная сумма");
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты для операций ledger2");

  // -------- lookup registry --------
  const ActionRegistryEntry* entry = ledger2_find_action(action_code);
  eosio::check(entry != nullptr,
               std::string{"Unknown action code: "} + action_code.to_string());

  // =====================================================================
  // Уровень 1 — кошельки + журнал wjournal (wallet-level)
  // =====================================================================
  wallets2_index wallets(get_self(), coopname.value);

  auto upsert_wallet = [&](uint64_t wallet_id) -> wallets2_index::const_iterator {
    auto it = wallets.find(wallet_id);
    if (it == wallets.end()) {
      std::string name = ledger2_get_wallet_name_by_id(wallet_id);
      eosio::check(!name.empty(),
                   std::string{"Unknown wallet id: "} + std::to_string(wallet_id));
      it = wallets.emplace(payer, [&](auto& w) {
        w.id        = wallet_id;
        w.name      = name;
        w.available = eosio::asset(0, amount.symbol);
        w.blocked   = eosio::asset(0, amount.symbol);
      });
    }
    return it;
  };

  auto cleanup_if_empty = [&](uint64_t wallet_id) {
    auto it = wallets.find(wallet_id);
    if (it != wallets.end() && it->is_empty()) {
      wallets.erase(it);
    }
  };

  switch (entry->wallet_op) {
    case WalletOp::ISSUE: {
      eosio::check(entry->wallet_to != 0, "ISSUE requires wallet_to");
      auto it = upsert_wallet(entry->wallet_to);
      wallets.modify(it, payer, [&](auto& w) { w.available += amount; });
      break;
    }
    case WalletOp::TRANSFER: {
      eosio::check(entry->wallet_from != 0 && entry->wallet_to != 0,
                   "TRANSFER requires wallet_from and wallet_to");
      auto from_it = wallets.find(entry->wallet_from);
      eosio::check(from_it != wallets.end() && from_it->available >= amount,
                   std::string{"Insufficient wallet balance: "} +
                     std::to_string(entry->wallet_from));
      wallets.modify(from_it, payer, [&](auto& w) { w.available -= amount; });
      auto to_it = upsert_wallet(entry->wallet_to);
      wallets.modify(to_it, payer, [&](auto& w) { w.available += amount; });
      cleanup_if_empty(entry->wallet_from);
      break;
    }
    case WalletOp::BLOCK: {
      eosio::check(entry->wallet_from != 0, "BLOCK requires wallet_from");
      auto it = wallets.find(entry->wallet_from);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"Insufficient wallet balance for BLOCK: "} +
                     std::to_string(entry->wallet_from));
      wallets.modify(it, payer, [&](auto& w) {
        w.available -= amount;
        w.blocked   += amount;
      });
      break;
    }
    case WalletOp::UNBLOCK: {
      eosio::check(entry->wallet_from != 0, "UNBLOCK requires wallet_from");
      auto it = wallets.find(entry->wallet_from);
      eosio::check(it != wallets.end() && it->blocked >= amount,
                   std::string{"Insufficient blocked balance for UNBLOCK: "} +
                     std::to_string(entry->wallet_from));
      wallets.modify(it, payer, [&](auto& w) {
        w.blocked   -= amount;
        w.available += amount;
      });
      break;
    }
  }

  // Фиксация атомарной операции кошелька в журнале wjournal.
  wjournal_index wjournal(get_self(), coopname.value);
  uint64_t wjournal_id = wjournal.available_primary_key();
  const auto now = eosio::current_time_point();
  wjournal.emplace(payer, [&](auto& w) {
    w.id                = wjournal_id;
    w.wallet_op         = static_cast<uint8_t>(entry->wallet_op);
    w.wallet_from       = entry->wallet_from;
    w.wallet_to         = entry->wallet_to;
    w.amount            = amount;
    w.action_code       = action_code;
    w.journal_entry_id  = 0; // backfill после записи в journal
    w.username          = username;
    w.memo              = memo;
    w.document_hash     = document_hash;
    w.created_at        = now;
  });

  // =====================================================================
  // Уровень 2 — счета + журнал journal (account-level, двойная запись)
  // =====================================================================
  accounts2_index accounts(get_self(), coopname.value);

  auto upsert_account = [&](uint64_t account_id) -> accounts2_index::const_iterator {
    auto it = accounts.find(account_id);
    if (it == accounts.end()) {
      const auto* meta = ledger2_find_account_meta(account_id);
      eosio::check(meta != nullptr,
                   std::string{"Unknown account id: "} + std::to_string(account_id));
      it = accounts.emplace(payer, [&](auto& a) {
        a.id             = account_id;
        a.name           = meta->name;
        a.account_type   = static_cast<uint8_t>(meta->type);
        a.debit_balance  = eosio::asset(0, amount.symbol);
        a.credit_balance = eosio::asset(0, amount.symbol);
      });
    }
    return it;
  };

  // Дебетуемый счёт: debit_balance += amount (обороты).
  // Рост/падение сальдо определится в get_balance() по account_type.
  auto dr_it = upsert_account(entry->debit_account_id);
  accounts.modify(dr_it, payer, [&](auto& a) { a.debit_balance += amount; });

  // Кредитуемый счёт: credit_balance += amount (обороты).
  auto cr_it = upsert_account(entry->credit_account_id);
  accounts.modify(cr_it, payer, [&](auto& a) { a.credit_balance += amount; });

  // Парная проводка в journal.
  journal_index journal(get_self(), coopname.value);
  uint64_t journal_id = journal.available_primary_key();
  journal.emplace(payer, [&](auto& e) {
    e.id                = journal_id;
    e.debit_account_id  = entry->debit_account_id;
    e.credit_account_id = entry->credit_account_id;
    e.amount            = amount;
    e.action_code       = action_code;
    e.wjournal_entry_id = wjournal_id;
    e.operation_hash    = document_hash;
    e.memo              = memo;
    e.created_at        = now;
  });

  // Backfill: проставляем id проводки в запись wjournal.
  auto w_it = wjournal.find(wjournal_id);
  wjournal.modify(w_it, payer, [&](auto& w) { w.journal_entry_id = journal_id; });
}
