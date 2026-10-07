/**
 * @brief Приложение сообщило о погашении своего займа на сумму.
 *
 * Остаток уменьшается, при нуле запись удаляется.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от контракта-источника записи
 */
void debt::settleloan(SETTLELOAN_SIGNATURE) {
  name source = check_auth_and_get_payer_or_fail(contracts_whitelist);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.source == source, "Погашение сообщает приложение, которое выдало заём");
  Wallet::validate_asset(amount);
  eosio::check(amount <= d.remaining, "Сумма погашения больше остатка займа");

  Debt::Core::change_summary(coopname, d.username, -amount);

  eosio::asset remaining = d.remaining - amount;
  if (remaining.amount == 0) {
    Debt::Core::erase_debt(coopname, d.id);
  } else {
    Debt::Core::modify_debt(coopname, d.id, [&](auto& row) { row.remaining = remaining; });
  }

  require_recipient(d.username);
  require_recipient(coopname);
}
