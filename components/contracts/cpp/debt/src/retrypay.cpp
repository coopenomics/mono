/**
 * @brief Повторная отправка платежа после отказа по реквизитам.
 *
 * Новое заседание совета и новая подпись не нужны: платёж уходит кассиру тем
 * же решением.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::retrypay(eosio::name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::SIGNED, "Повторить платёж можно по подписанному договору после отказа кассира");
  eosio::check(!d.last_pay_error.empty(), "Повторная отправка возможна только после отказа платежа");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) { row.status = Debt::Status::PAYING; });
  Debt::Core::send_payout(coopname, d);

  require_recipient(d.username);
  require_recipient(coopname);
}
