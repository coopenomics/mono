/**
 * @brief Откат ранее проведённой операции (operation o.adj.rev).
 *
 * **Contract-only**: top-level вызов председателем (`coopname@active`) запрещён.
 * Action принимает только подпись от whitelisted контрактов
 * (`contracts_whitelist`) — то есть зеркальная проводка возможна только когда
 * её инициирует другой контракт-инициатор (registrator/wallet/capital/...),
 * который параллельно откатывает свой собственный state.
 *
 * Why this restriction: ledger2 — учётный слой; зеркальная проводка не трогает
 * сущности контрактов-инициаторов (participants/deposits/contributors).
 * Top-level откат председателем рассинхронизирует учёт и состояние домена
 * (например, participant остаётся accepted, а минимальный паевой «вернулся»).
 *
 * Контракт не имеет доступа к истории `blockchain_actions` — параметры зеркала
 * собирает контракт-инициатор (он знает свой исходный operation_code и
 * соответствующие Dr/Cr/wallet через operations.hpp registry).
 *
 * Запрет на откат миграционных операций (`o.mig.*`) сохранён.
 * Повторный откат отката (revert от revert) разрешён.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::revert(eosio::name coopname,
                     eosio::name initiator,
                     uint64_t original_operation_id,
                     eosio::name original_operation_code,
                     eosio::name username,
                     eosio::asset amount,
                     uint8_t mirror_wallet_op,
                     eosio::name mirror_wallet_from,
                     eosio::name mirror_wallet_to,
                     uint64_t mirror_debit_account_id,
                     uint64_t mirror_credit_account_id,
                     eosio::checksum256 process_hash,
                     std::string memo) {
  // -------- auth: только whitelist-контракты, председатель напрямую запрещён --------
  check_auth_and_get_payer_or_fail(contracts_whitelist);

  // -------- validate coopname --------
  eosio::check(coopname.value != 0, "revert: coopname пустой");
  get_cooperative_or_fail(coopname);
  require_recipient(coopname);

  // -------- validate initiator/username --------
  eosio::check(initiator.value != 0, "revert: initiator пустой");
  eosio::check(username.value != 0, "revert: username пустой");

  // -------- validate amount --------
  eosio::check(amount.is_valid(), "revert: некорректная сумма");
  eosio::check(amount.amount > 0, "revert: сумма должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol,
               "revert: некорректный символ валюты");

  // -------- validate memo --------
  eosio::check(!memo.empty(), "revert: memo обязателен — укажите обоснование");
  eosio::check(memo.size() < 256, "revert: memo не должен превышать 255 символов");

  // -------- запрет на откат миграционных операций --------
  // Префикс o.mig. (6 символов) — eosio::name.to_string() стабилен.
  const auto code_str = original_operation_code.to_string();
  eosio::check(code_str.size() < 6 || code_str.substr(0, 6) != "o.mig.",
               "revert: откат миграционных операций (o.mig.*) запрещён — используйте walmove или ручную корректировку через совет");

  // -------- validate original_operation_id --------
  eosio::check(original_operation_id != 0, "revert: original_operation_id обязателен");

  // -------- validate mirror_wallet_op --------
  eosio::check(mirror_wallet_op <= 5, "revert: неизвестный mirror_wallet_op");
  // Не позволяем откатывать через BLOCK/UNBLOCK — они асимметричны и нет
  // адекватного зеркала в одной операции (BLOCK + UNBLOCK — обратные сами по себе).
  eosio::check(mirror_wallet_op != static_cast<uint8_t>(WalletOp::BLOCK) &&
               mirror_wallet_op != static_cast<uint8_t>(WalletOp::UNBLOCK),
               "revert: BLOCK/UNBLOCK не подлежат откату через revert (они симметричны сами себе)");

  // -------- validate mirror wallets/accounts --------
  if (mirror_wallet_from.value != 0) {
    eosio::check(ledger2_is_known_wallet(mirror_wallet_from),
                 std::string{"revert: неизвестный mirror_wallet_from "} + mirror_wallet_from.to_string());
  }
  if (mirror_wallet_to.value != 0) {
    eosio::check(ledger2_is_known_wallet(mirror_wallet_to),
                 std::string{"revert: неизвестный mirror_wallet_to "} + mirror_wallet_to.to_string());
  }

  // ADR-003: «без бухпроводок» — пара (debit_account_id == 0, credit_account_id == 0).
  // Соответственно zero-mirror = откат операции, у которой не было Dr/Cr (для walmove
  // и других «без проводок»-сценариев).
  const bool zero_mirror = (mirror_debit_account_id == 0 && mirror_credit_account_id == 0);
  if (zero_mirror) {
    // OK — откат без бухпроводок (zero-zero пара).
  } else {
    eosio::check(mirror_debit_account_id != 0 && mirror_credit_account_id != 0,
                 "revert: смешанная пара mirror_debit/credit_account_id (один == 0, второй ≠ 0) запрещена");
    eosio::check(mirror_debit_account_id != mirror_credit_account_id,
                 "revert: mirror_debit_account_id == mirror_credit_account_id (self-posting запрещён)");
    eosio::check(ledger2_find_account_meta(mirror_debit_account_id) != nullptr,
                 std::string{"revert: неизвестный mirror_debit_account_id "} + std::to_string(mirror_debit_account_id));
    eosio::check(ledger2_find_account_meta(mirror_credit_account_id) != nullptr,
                 std::string{"revert: неизвестный mirror_credit_account_id "} + std::to_string(mirror_credit_account_id));
  }

  // -------- dispatch inline walletop + (опц.) debit/credit --------
  const auto self_perm = eosio::permission_level{get_self(), "active"_n};

  eosio::action(self_perm, get_self(), "walletop"_n,
    std::make_tuple(coopname,
                    mirror_wallet_op,
                    mirror_wallet_from, mirror_wallet_to, username, amount,
                    process_hash, memo)
  ).send();

  if (zero_mirror) {
    return;
  }

  eosio::action(self_perm, get_self(), "debit"_n,
    std::make_tuple(coopname,
                    mirror_debit_account_id,
                    amount,
                    process_hash, memo)
  ).send();

  eosio::action(self_perm, get_self(), "credit"_n,
    std::make_tuple(coopname,
                    mirror_credit_account_id,
                    amount,
                    process_hash, memo)
  ).send();
}
