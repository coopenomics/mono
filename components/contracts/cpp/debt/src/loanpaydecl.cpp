/**
 * @brief Платёж не прошёл по реквизитам.
 *
 * Решение совета и подпись председателя остаются в силе, причина сохраняется,
 * заём ждёт повторной отправки платежа.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
void debt::loanpaydecl(eosio::name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(_gateway);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::PAYING, "Отказ платежа приходит по займу, переданному кассиру");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::SIGNED;
    row.last_pay_error = reason.empty() ? std::string("Платёж отклонён кассиром") : reason;
  });

  require_recipient(d.username);
  require_recipient(coopname);
}
