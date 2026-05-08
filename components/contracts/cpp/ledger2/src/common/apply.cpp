/**
 * @brief Единая точка входа ledger2 для финансовых движений (orchestrator).
 *
 * Пересмотр 2026-04-18 (Epic 1 addendum): apply ничего не пишет в state
 * напрямую. Это orchestrator, который рассылает 3 атомарных inline action:
 *
 *   1. ledger2::walletop — issue/transfer/block/unblock на wallets2
 *   2. ledger2::debit    — +debit_balance на accounts2[Dr] + пересчёт сальдо
 *   3. ledger2::credit   — +credit_balance на accounts2[Cr] + пересчёт сальдо
 *
 * Все три inline-actions передают единый `process_hash`, что позволяет
 * бэкенду собрать «тройку» из blockchain_actions:
 *   WHERE account = 'ledger2' AND data->>'process_hash' = X
 *
 * История проводок не хранится в RAM-таблицах — она целиком восстанавливается
 * на бэкенде из blockchain_actions (для apply/walletop/debit/credit) и
 * blockchain_deltas (для accounts2 и wallets2). Это даёт:
 *   - дешевле RAM (O(1) state на счёт + кошелёк, не O(N) проводок);
 *   - проще контракт (нет emplace/backfill в журналы);
 *   - лучше observability (каждое движение — отдельная action в трейсах).
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::apply(eosio::name coopname,
                    eosio::name initiator,
                    eosio::name operation_code,
                    eosio::asset amount,
                    eosio::name username,
                    eosio::checksum256 process_hash,
                    std::string memo) {
  // -------- auth --------
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  // -------- validate coopname --------
  // Используем общий хелпер из lib/domain/table_registrator_coops.hpp —
  // он проверяет и существование, и флаг is_cooperative, и статус='active'.
  eosio::check(coopname.value != 0, "coopname пустой");
  get_cooperative_or_fail(coopname);

  // Нотификация кооперативу — только после валидации, чтобы не отправлять
  // recipient-хук на несуществующий/неправильный coopname.
  require_recipient(coopname);

  // -------- validate amount --------
  eosio::check(amount.is_valid(), "Некорректная сумма");
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты для операций ledger2");

  // -------- validate memo --------
  eosio::check(memo.size() < 256, "memo не должен превышать 255 символов");

  // -------- lookup registry --------
  const OperationRegistryEntry* entry = find_operation(operation_code);
  eosio::check(entry != nullptr,
               std::string{"Unknown operation code: "} + operation_code.to_string());

  // -------- username обязателен для USER_SHARED (Story 3.2; ADR-002) --------
  // Исключение — миграционные коды (`o.mig.*`): legacy-агрегация без L3.
  {
    const auto code_str = operation_code.to_string();
    const bool is_migration = code_str.size() >= 6 && code_str.substr(0, 6) == "o.mig.";
    if (!is_migration) {
      auto require_username = [&](eosio::name w) {
        if (w.value == 0) return;
        if (ledger2_get_wallet_kind(w) == WalletKind::USER_SHARED) {
          eosio::check(username.value != 0,
                       std::string{"apply: username обязателен для USER_SHARED-кошелька "} +
                         w.to_string() + " (operation_code=" + code_str + ")");
        }
      };
      require_username(entry->wallet_from);
      require_username(entry->wallet_to);
    }
  }

  // -------- dispatch atomic inline actions --------
  // Для записей с проводкой и кошельком — «тройка» (walletop + debit + credit)
  // с общим process_hash. Для записей без бухпроводки (оба account_id == 0,
  // ADR-003) — только walletop: перенос средств между аналитическими
  // разрезами одного бухсчёта, без debit/credit. Для записей без кошелькового
  // движения (`WalletOp::NONE`, обе проводки заполнены) — только debit + credit:
  // внутрибалансовый перенос (например, ACCEPT_RID Dr 04 / Cr 08 — кошелёк
  // остаётся на текущем программном фонде, перемещается отдельным шагом).
  const auto self_perm = eosio::permission_level{get_self(), "active"_n};

  if (entry->wallet_op != WalletOp::NONE) {
    eosio::action(self_perm, get_self(), "walletop"_n,
      std::make_tuple(coopname,
                      static_cast<uint8_t>(entry->wallet_op),
                      entry->wallet_from,
                      entry->wallet_to,
                      username,
                      amount,
                      process_hash,
                      memo)
    ).send();
  }

  if (entry->debit_account_id == 0 && entry->credit_account_id == 0) {
    return;
  }

  eosio::action(self_perm, get_self(), "debit"_n,
    std::make_tuple(coopname,
                    entry->debit_account_id,
                    amount,
                    process_hash,
                    memo)
  ).send();

  eosio::action(self_perm, get_self(), "credit"_n,
    std::make_tuple(coopname,
                    entry->credit_account_id,
                    amount,
                    process_hash,
                    memo)
  ).send();
}
