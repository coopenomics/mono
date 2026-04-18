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
                    eosio::name action_code,
                    eosio::asset amount,
                    eosio::name username,
                    eosio::checksum256 process_hash,
                    std::string memo) {
  require_recipient(coopname);

  // -------- auth --------
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  // -------- validate coopname --------
  eosio::check(coopname.value != 0, "coopname пустой");
  cooperatives2_index coops(_registrator, _registrator.value);
  eosio::check(coops.find(coopname.value) != coops.end(),
               std::string{"Неизвестный coopname: "} + coopname.to_string());

  // -------- validate amount --------
  eosio::check(amount.is_valid(), "Некорректная сумма");
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты для операций ledger2");

  // -------- validate memo --------
  eosio::check(memo.size() < 256, "memo не должен превышать 255 символов");

  // -------- lookup registry --------
  const ActionRegistryEntry* entry = ledger2_find_action(action_code);
  eosio::check(entry != nullptr,
               std::string{"Unknown action code: "} + action_code.to_string());

  // -------- dispatch 3 atomic inline actions --------
  // Каждая inline получает общий process_hash, чтобы бэкенд мог собрать
  // их в «тройку» (walletop + debit + credit) по этому хэшу.
  const auto self_perm = eosio::permission_level{get_self(), "active"_n};

  eosio::action(self_perm, get_self(), "walletop"_n,
    std::make_tuple(coopname,
                    static_cast<uint8_t>(entry->wallet_op),
                    entry->wallet_from,
                    entry->wallet_to,
                    amount,
                    process_hash,
                    memo)
  ).send();

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
