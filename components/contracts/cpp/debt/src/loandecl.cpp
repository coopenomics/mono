/**
 * @brief Совет отказал в выдаче займа.
 *
 * Обеспечение возвращается в программу, запись удаляется.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loandecl(eosio::name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::CREATED, "Отказать можно только по заявлению на рассмотрении совета");

  Debt::Core::abandon_before_issue(coopname, d);

  require_recipient(d.username);
  require_recipient(coopname);
}
