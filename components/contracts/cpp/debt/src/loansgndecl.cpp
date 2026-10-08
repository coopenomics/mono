/**
 * @brief Председатель отказался подписывать договор займа.
 *
 * Обеспечение возвращается в программу, запись удаляется.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loansgndecl(eosio::name coopname, eosio::name username, checksum256 debt_hash, std::string reason) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::AUTHORIZED, "Отказать в подписи можно только по договору, который ждёт председателя");
  // username — председатель, подтвердивший одобрение: совет передаёт его имя, не имя заёмщика.

  Debt::Core::abandon_before_issue(coopname, d);

  require_recipient(d.username);
  require_recipient(coopname);
}
